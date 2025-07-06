import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { act } from "react";

// next/image is mocked globally in jest.config.js

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

global.fetch = jest.fn();

// Mock react-datepicker to be a simple input for testability
jest.mock("react-datepicker", () => (props: any) => {
  // Simulate a controlled input that calls onChange with a Date object
  return (
    <input
      type="text"
      placeholder={props.placeholderText}
      value={props.selected ? props.selected.toISOString().slice(0, 10) : ""}
      onChange={(e) => {
        // Always call onChange with a Date object
        props.onChange && props.onChange(new Date(e.target.value));
      }}
      onBlur={props.onBlur}
      className={props.className}
    />
  );
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
      screen.getByRole("button", { name: /book & pay/i })
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
    mockUser = { uid: "user123" };
    const CourtDetailPage = require("./page").default;

    // Mock fetch
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      json: jest.fn().mockResolvedValue({ url: "https://stripe.com/checkout" }),
      status: 200,
      statusText: "OK",
      ok: true,
      headers: {
        get: jest.fn(),
        append: jest.fn(),
        delete: jest.fn(),
        getSetCookie: jest.fn(),
        has: jest.fn(),
        set: jest.fn(),
        forEach: jest.fn(),
        entries: jest.fn(),
        keys: jest.fn(),
        values: jest.fn(),
        [Symbol.iterator]: jest.fn(),
      },
      redirected: false,
      type: "basic",
      url: "",
      clone: jest.fn(),
      body: null,
      bodyUsed: false,
      arrayBuffer: jest.fn(),
      blob: jest.fn(),
      formData: jest.fn(),
      text: jest.fn(),
      bytes: jest.fn(),
    });

    render(<CourtDetailPage />);

    // Wait for court to load
    await screen.findByText("Test Court");

    // Set date by directly calling the onChange handler of the DatePicker
    // Find the input and fire a change event with a real Date object
    const dateInput = screen.getByPlaceholderText("Select date");
    fireEvent.change(dateInput, { target: { value: "2025-07-01" } });
    // Manually set the value in the component's state by firing a blur event (triggers onChange in react-datepicker)
    fireEvent.blur(dateInput);

    // Set time and duration
    fireEvent.change(screen.getByLabelText(/time/i), {
      target: { value: "10:00" },
    });
    fireEvent.change(screen.getByLabelText(/duration/i), {
      target: { value: "2" },
    });

    // Click the booking button
    fireEvent.click(screen.getByRole("button", { name: /book & pay/i }));

    // Wait for fetch to be called
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/create-checkout-session",
        expect.objectContaining({ method: "POST" })
      );
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
      screen.queryByRole("button", { name: /book & pay/i })
    ).not.toBeInTheDocument();
  });
});
