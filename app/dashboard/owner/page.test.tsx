import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import OwnerDashboard from "./page";

// Mock next/image to avoid errors in Jest
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />;
  },
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Use a variable to control the mock return value for useAuth
let mockAuthValue: {
  user: { uid: string; email: string } | null;
  loading: boolean;
} = { user: { uid: "owner-uid", email: "owner@example.com" }, loading: false };
jest.mock("@/src/lib/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

// Mock Firestore
jest.mock("@/src/lib/firebase", () => ({
  db: {},
}));
jest.mock("firebase/firestore", () => {
  return {
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(),
    orderBy: jest.fn(),
  };
});

const { getDocs } = require("firebase/firestore");

describe("OwnerDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    mockAuthValue = {
      user: { uid: "owner-uid", email: "owner@example.com" },
      loading: false,
    };
  });

  it("renders courts and bookings for the owner", async () => {
    // Mock courts and bookings
    getDocs
      .mockResolvedValueOnce({
        docs: [
          {
            id: "court1",
            data: () => ({
              name: "Court 1",
              location: "Test Location",
              imageUrl: "https://example.com/court.jpg",
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: "booking1",
            data: () => ({
              courtId: "court1",
              userId: "player-uid",
              date: "2024-06-01",
              time: "10:00",
              duration: 2,
              status: "pending",
            }),
          },
        ],
      });
    render(<OwnerDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Court 1")).toBeInTheDocument();
      expect(screen.getByText("Test Location")).toBeInTheDocument();
      expect(screen.getByText("2024-06-01 at 10:00 (2h)"));
      expect(screen.getByText(/Status: pending/)).toBeInTheDocument();
      expect(screen.getByText(/User: player-uid/)).toBeInTheDocument();
    });
  });

  it("shows message when no courts", async () => {
    getDocs.mockResolvedValueOnce({ docs: [] });
    render(<OwnerDashboard />);
    await waitFor(() => {
      expect(
        screen.getByText("You have no courts listed yet.")
      ).toBeInTheDocument();
    });
  });

  it("shows message when a court has no bookings", async () => {
    getDocs
      .mockResolvedValueOnce({
        docs: [
          {
            id: "court1",
            data: () => ({
              name: "Court 1",
              location: "Test Location",
              imageUrl: "",
            }),
          },
        ],
      })
      .mockResolvedValueOnce({ docs: [] });
    render(<OwnerDashboard />);
    await waitFor(() => {
      expect(
        screen.getByText("No bookings for this court yet.")
      ).toBeInTheDocument();
    });
  });

  it("redirects to /login if not logged in", async () => {
    mockAuthValue = { user: null, loading: false };
    render(<OwnerDashboard />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("navigates to /create-listing when '+ Add New Court' is clicked", async () => {
    getDocs.mockResolvedValueOnce({ docs: [] });
    render(<OwnerDashboard />);
    const addBtn = await screen.findByText("+ Add New Court");
    fireEvent.click(addBtn);
    expect(mockPush).toHaveBeenCalledWith("/create-listing");
  });
});
