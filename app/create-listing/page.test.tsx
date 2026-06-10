import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateListingPage from "./page";

jest.mock("@/components/AppHeader", () => function MockAppHeader() {
  return <div data-testid="app-header" />;
});

// Mock Firebase auth
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
}));

// Mock Firebase storage
jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytes: jest.fn(() => Promise.resolve({ ref: {} })),
  getDownloadURL: jest.fn(() =>
    Promise.resolve("https://example.com/image.jpg")
  ),
}));

// Mock the getStorageInstance function
jest.mock("@/lib/firebase", () => ({
  db: {},
  getStorageInstance: jest.fn(() => ({})),
  isMockMode: false,
}));

// Mock Firebase firestore
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  addDoc: jest.fn(() => Promise.resolve({ id: "mock-doc-id" })),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}));

// Mock next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/create-listing",
}));

// Mock useAuth to return a user by default
jest.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "test-user-id", email: "test@example.com" } }),
}));

describe("CreateListingPage", () => {
  const mockFile = new File(["dummy content"], "test-image.png", {
    type: "image/png",
  });

  const fillPublishableListingFields = () => {
    fireEvent.change(screen.getByPlaceholderText("e.g. Brentwood Backyard Court"), {
      target: { value: "Test Court" },
    });
    fireEvent.change(screen.getByPlaceholderText("Complete street address"), {
      target: { value: "123 Test St" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Describe your court's surface, lighting, amenities, privacy, and anything players should know."),
      {
        target: { value: "A beautiful test court" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("25"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /self-check in/i }));
    fireEvent.change(
      screen.getByPlaceholderText(
        "Gate code, building access, where players should enter, and anything they need for check-in..."
      ),
      {
        target: { value: "Use the side gate and enter code 1234." },
      }
    );
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it("renders the create listing form", () => {
    render(<CreateListingPage />);

    // Check for form elements
    expect(screen.getByText("Create Court Listing")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Brentwood Backyard Court")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Describe your court's surface, lighting, amenities, privacy, and anything players should know."
      )
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("25")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Complete street address")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Listing" })
    ).toBeInTheDocument();
  });

  it("handles image upload", async () => {
    render(<CreateListingPage />);

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
  });

  it("validates required fields by filling some but not all fields", async () => {
    render(<CreateListingPage />);

    // Fill in some fields but not all
    fireEvent.change(screen.getByPlaceholderText("e.g. Brentwood Backyard Court"), {
      target: { value: "Test Court" },
    });
    // Don't fill in location, price, description, or image

    // Submit the form directly to bypass browser validation
    const form = screen
      .getByRole("button", { name: "Create Listing" })
      .closest("form");
    fireEvent.submit(form!);

    // Check for validation message
    await waitFor(() => {
      expect(
        screen.getByText(/Please add:/)
      ).toBeInTheDocument();
    });
  });

  it("successfully submits the form with valid data after owner waiver", async () => {
    const { uploadBytes, getDownloadURL } = require("firebase/storage");
    const { addDoc } = require("firebase/firestore");

    render(<CreateListingPage />);

    fillPublishableListingFields();

    // Upload image
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Submit the form — opens owner waiver dialog
    const form = screen
      .getByRole("button", { name: "Create Listing" })
      .closest("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Agree & publish listing" }));

    // Verify upload and submission
    await waitFor(() => {
      expect(uploadBytes).toHaveBeenCalled();
      expect(getDownloadURL).toHaveBeenCalled();
      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          name: "Test Court",
          description: "A beautiful test court",
          price: 50,
          address: "123 Test St",
          accessInstructions: "Use the side gate and enter code 1234.",
          bookableStatus: "active",
          imageUrl: "https://example.com/image.jpg",
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/host?tab=courts");
    });
  });

  it("handles upload errors gracefully", async () => {
    const { uploadBytes } = require("firebase/storage");
    (uploadBytes as jest.Mock).mockRejectedValueOnce(
      new Error("Upload failed")
    );

    render(<CreateListingPage />);

    fillPublishableListingFields();

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const form = screen
      .getByRole("button", { name: "Create Listing" })
      .closest("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Agree & publish listing" }));

    // Check for error message
    await waitFor(() => {
      expect(screen.getByText("Upload failed")).toBeInTheDocument();
    });
  });
});

// Add a custom matcher for finding file inputs by accept attribute
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
    }
  }
}

function getByAcceptedFileTypes(accept: string): HTMLElement {
  return screen.getByRole("textbox", { name: "" }) as HTMLElement;
}
