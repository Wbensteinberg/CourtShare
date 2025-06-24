import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { act } from "react";

// Mock next/image to render a simple img
jest.mock("next/image", () => (props: any) => (
  <img {...props} alt={props.alt} />
));

// Mock next/navigation
const mockBack = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "abc123" }),
  useRouter: () => ({ back: mockBack }),
}));

// Mock Firestore
const mockDb = {};
let mockBookings: any[] = [];
jest.mock("@/src/lib/firebase", () => ({ db: mockDb }));
jest.mock("firebase/firestore", () => {
  const actual = jest.requireActual("firebase/firestore");
  return {
    ...actual,
    doc: jest.fn(),
    getDoc: jest.fn(),
    addDoc: jest.fn(),
    collection: jest.fn(() => ({})),
    getDocs: jest.fn(() =>
      Promise.resolve({ docs: mockBookings.map((b) => ({ data: () => b })) })
    ),
    Timestamp: {
      now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
    },
  };
});
const { getDoc, addDoc, collection, getDocs } = require("firebase/firestore");

// --- Auth Mocking ---
let mockUser: any = null;
jest.mock("@/src/lib/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockCourt = {
  name: "Test Court",
  location: "Santa Barbara",
  price: 50,
  description: "A beautiful test court for all levels.",
  imageUrl: "https://example.com/court.jpg",
};

// Mock window.alert to prevent jsdom errors
beforeAll(() => {
  window.alert = jest.fn();
});

describe("CourtDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null; // default to logged out
  });

  it("shows loading state initially", () => {
    getDoc.mockReturnValue(new Promise(() => {})); // never resolves
    const CourtDetailPage = require("./page").default;
    render(<CourtDetailPage />);
    expect(screen.getByText(/loading court/i)).toBeInTheDocument();
  });

  it("shows error state if Firestore fails", async () => {
    getDoc.mockRejectedValue(new Error("Firestore error"));
    const CourtDetailPage = require("./page").default;
    render(<CourtDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/firestore error/i)).toBeInTheDocument();
    });
  });

  it("shows not found if court does not exist", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    const CourtDetailPage = require("./page").default;
    render(<CourtDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/court not found/i)).toBeInTheDocument();
    });
  });

  it("renders all court info if found (not logged in)", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => mockCourt });
    mockUser = null;
    const CourtDetailPage = require("./page").default;
    render(<CourtDetailPage />);
    expect(await screen.findByText("Test Court")).toBeInTheDocument();
    expect(screen.getByText("Santa Barbara")).toBeInTheDocument();
    expect(
      screen.getByText((content, node) =>
        node ? node.textContent === "$50 / hour" : false
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/A beautiful test court/i)).toBeInTheDocument();
    expect(screen.getByAltText("Test Court")).toBeInTheDocument();
    // Should NOT show booking button if not logged in
    expect(
      screen.queryByRole("button", { name: /book this court/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/log in to book this court/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to browse/i })
    ).toBeInTheDocument();
  });

  it("renders all court info if found (logged in)", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => mockCourt });
    mockUser = { uid: "user123" };
    const CourtDetailPage = require("./page").default;
    render(<CourtDetailPage />);
    expect(await screen.findByText("Test Court")).toBeInTheDocument();
    expect(screen.getByText("Santa Barbara")).toBeInTheDocument();
    expect(
      screen.getByText((content, node) =>
        node ? node.textContent === "$50 / hour" : false
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/A beautiful test court/i)).toBeInTheDocument();
    expect(screen.getByAltText("Test Court")).toBeInTheDocument();
    // Should show booking button if logged in
    expect(
      screen.getByRole("button", { name: /book court/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to browse/i })
    ).toBeInTheDocument();
  });

  it("calls router.back when Back to Browse is clicked", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => mockCourt });
    const CourtDetailPage = require("./page").default;
    render(<CourtDetailPage />);
    const btn = await screen.findByRole("button", { name: /back to browse/i });
    fireEvent.click(btn);
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows booking form if user is logged in and can book a court", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => mockCourt });
    addDoc.mockResolvedValue({ id: "booking123" });
    mockUser = { uid: "user123" };
    const CourtDetailPage = require("./page").default;
    render(<CourtDetailPage />);
    expect(await screen.findByText("Test Court")).toBeInTheDocument();
    // Select the date (simulate user picking a date)
    const dateInput = await waitFor(() =>
      screen.getByPlaceholderText(/select date/i)
    );
    await act(async () => {
      fireEvent.change(dateInput, { target: { value: "2025-07-01" } });
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/time/i), {
        target: { value: "10:00" },
      });
      fireEvent.change(screen.getByLabelText(/duration/i), {
        target: { value: "2" },
      });
      fireEvent.click(screen.getByRole("button", { name: /book court/i }));
    });
    // Wait for success message
    await waitFor(() => {
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: "user123",
          courtId: "abc123",
          date: "2025-07-01",
          time: "10:00",
          duration: 2,
        })
      );
      expect(screen.getByText(/booking submitted/i)).toBeInTheDocument();
    });
  });

  it("does not show booking form if user is not logged in", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => mockCourt });
    mockUser = null;
    const CourtDetailPage = require("./page").default;
    render(<CourtDetailPage />);
    expect(await screen.findByText("Test Court")).toBeInTheDocument();
    expect(screen.getByText(/log in to book this court/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /book court/i })
    ).not.toBeInTheDocument();
  });
});
