import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CourtsPage from "./page";

// Mock next/image to render a simple img
jest.mock("next/image", () => (props: any) => (
  <img {...props} alt={props.alt} />
));

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

  it("redirects to /login if not logged in", async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(<CourtsPage />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
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

  it("shows user info and logout button", async () => {
    useAuth.mockReturnValue({
      user: { email: "test@court.com" },
      loading: false,
    });
    getDocs.mockResolvedValue({ docs: [] });
    render(<CourtsPage />);
    expect(await screen.findByText("test@court.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log out/i })
    ).toBeInTheDocument();
  });

  it("calls signOut and redirects on logout", async () => {
    const { signOut } = require("firebase/auth");
    useAuth.mockReturnValue({
      user: { email: "test@court.com" },
      loading: false,
    });
    getDocs.mockResolvedValue({ docs: [] });
    render(<CourtsPage />);
    const btn = await screen.findByRole("button", { name: /log out/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
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
});
