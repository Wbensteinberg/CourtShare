import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateListingPage from "./page";

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
}));

// Mock Firebase firestore
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(() => Promise.resolve({ id: "mock-doc-id" })),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock useAuth to return a user by default
jest.mock("@/src/lib/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "test-user-id", email: "test@example.com" } }),
}));

describe("CreateListingPage", () => {
  const mockFile = new File(["dummy content"], "test-image.png", {
    type: "image/png",
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it("renders the create listing form", () => {
    render(<CreateListingPage />);

    // Check for form elements
    expect(screen.getByText("Create Court Listing")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Court Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Description")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Price per hour (USD)")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Location")).toBeInTheDocument();
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
    fireEvent.change(screen.getByPlaceholderText("Court Name"), {
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
        screen.getByText("Please fill in all fields and upload an image.")
      ).toBeInTheDocument();
    });
  });

  it("successfully submits the form with valid data", async () => {
    const { uploadBytes, getDownloadURL } = require("firebase/storage");
    const { addDoc } = require("firebase/firestore");

    render(<CreateListingPage />);

    // Fill in the form
    fireEvent.change(screen.getByPlaceholderText("Court Name"), {
      target: { value: "Test Court" },
    });
    fireEvent.change(screen.getByPlaceholderText("Description"), {
      target: { value: "A beautiful test court" },
    });
    fireEvent.change(screen.getByPlaceholderText("Price per hour (USD)"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByPlaceholderText("Location"), {
      target: { value: "123 Test St" },
    });

    // Upload image
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Submit the form
    const form = screen
      .getByRole("button", { name: "Create Listing" })
      .closest("form");
    fireEvent.submit(form!);

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
          location: "123 Test St",
          imageUrl: "https://example.com/image.jpg",
        })
      );
      expect(
        screen.getByText("Court listed successfully!")
      ).toBeInTheDocument();
      expect(mockPush).toHaveBeenCalledWith("/dashboard/owner");
    });
  });

  it("handles upload errors gracefully", async () => {
    const { uploadBytes } = require("firebase/storage");
    (uploadBytes as jest.Mock).mockRejectedValueOnce(
      new Error("Upload failed")
    );

    render(<CreateListingPage />);

    // Fill in the form and try to submit
    fireEvent.change(screen.getByPlaceholderText("Court Name"), {
      target: { value: "Test Court" },
    });
    fireEvent.change(screen.getByPlaceholderText("Description"), {
      target: { value: "A beautiful test court" },
    });
    fireEvent.change(screen.getByPlaceholderText("Price per hour (USD)"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByPlaceholderText("Location"), {
      target: { value: "123 Test St" },
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const form = screen
      .getByRole("button", { name: "Create Listing" })
      .closest("form");
    fireEvent.submit(form!);

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
