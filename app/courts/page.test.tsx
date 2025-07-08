import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CourtsPage from "./page";

// next/image is mocked globally in jest.config.js

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock firebase/auth
jest.mock("firebase/auth", () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

// Mock AuthContext
jest.mock("@/src/lib/AuthContext", () => ({
  useAuth: jest.fn(),
}));
const { useAuth } = require("@/src/lib/AuthContext");

// Mock Firestore
jest.mock("@/src/lib/firebase", () => ({
  db: {},
  auth: {},
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(() => ({})),
  updateDoc: jest.fn(() => Promise.resolve()),
}));
const { getDocs } = require("firebase/firestore");

const mockCourts = [
  {
    id: "1",
    name: "Will's Court",
    location: "Goleta",
    price: 25,
    description: "A beautiful court by the beach",
    imageUrl: "https://example.com/court.jpg",
  },
  {
    id: "2",
    name: "City Center Court",
    location: "Santa Barbara",
    price: 40,
    description: "Central location, great lighting",
    imageUrl: "",
  },
];

describe("CourtsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state", () => {
    useAuth.mockReturnValue({
      user: { email: "test@court.com" },
      loading: false,
    });
    getDocs.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CourtsPage />);
    expect(screen.getByText(/loading courts/i)).toBeInTheDocument();
  });

  it("shows error state", async () => {
    useAuth.mockReturnValue({
      user: { email: "test@court.com" },
      loading: false,
    });
    getDocs.mockRejectedValue(new Error("Firestore error"));
    render(<CourtsPage />);
    await waitFor(() => {
      expect(screen.getByText(/firestore error/i)).toBeInTheDocument();
    });
  });

  it("shows profile and menu for logged in user", async () => {
    useAuth.mockReturnValue({
      user: { email: "test@court.com" },
      loading: false,
      isOwner: false,
      setIsOwner: jest.fn(),
    });
    getDocs.mockResolvedValue({ docs: [] });
    render(<CourtsPage />);
    // Should show profile avatar button
    expect(
      await screen.findByRole("button", { name: /profile/i })
    ).toBeInTheDocument();
    // Should show hamburger menu button
    expect(
      screen.getByRole("button", { name: /open menu/i })
    ).toBeInTheDocument();
  });

  it("renders court cards with all info", async () => {
    useAuth.mockReturnValue({
      user: { email: "test@court.com" },
      loading: false,
    });
    getDocs.mockResolvedValue({
      docs: mockCourts.map((court) => ({ id: court.id, data: () => court })),
    });
    render(<CourtsPage />);
    expect(await screen.findByText("Will's Court")).toBeInTheDocument();
    expect(screen.getByText("Goleta")).toBeInTheDocument();
    expect(
      screen.getByText(/A beautiful court by the beach/i)
    ).toBeInTheDocument();
    expect(screen.getByAltText("Will's Court")).toBeInTheDocument();
    expect(screen.getByText("City Center Court")).toBeInTheDocument();
    expect(screen.getByText("Santa Barbara")).toBeInTheDocument();
    expect(
      screen.getByText(/Central location, great lighting/i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /view details/i })
    ).toHaveLength(2);
  });

  it("shows 'No courts found' if empty", async () => {
    useAuth.mockReturnValue({
      user: { email: "test@court.com" },
      loading: false,
    });
    getDocs.mockResolvedValue({ docs: [] });
    render(<CourtsPage />);
    expect(await screen.findByText(/no courts found/i)).toBeInTheDocument();
  });

  it("calls signOut when logout is clicked in menu", async () => {
    const { signOut } = require("firebase/auth");
    useAuth.mockReturnValue({
      user: { email: "test@court.com" },
      loading: false,
      isOwner: false,
      setIsOwner: jest.fn(),
    });
    getDocs.mockResolvedValue({ docs: [] });
    render(<CourtsPage />);
    // Open menu
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    // Click logout
    const logoutBtn = await screen.findByRole("button", { name: /log out/i });
    fireEvent.click(logoutBtn);
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
  });
});
