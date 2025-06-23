import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CourtDetailPage from "./page";

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
jest.mock("@/src/lib/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));
const { getDoc } = require("firebase/firestore");

const mockCourt = {
  name: "Test Court",
  location: "Santa Barbara",
  price: 50,
  description: "A beautiful test court for all levels.",
  imageUrl: "https://example.com/court.jpg",
};

describe("CourtDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state initially", () => {
    getDoc.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CourtDetailPage />);
    expect(screen.getByText(/loading court/i)).toBeInTheDocument();
  });

  it("shows error state if Firestore fails", async () => {
    getDoc.mockRejectedValue(new Error("Firestore error"));
    render(<CourtDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/firestore error/i)).toBeInTheDocument();
    });
  });

  it("shows not found if court does not exist", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    render(<CourtDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/court not found/i)).toBeInTheDocument();
    });
  });

  it("renders all court info if found", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => mockCourt });
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
    expect(
      screen.getByRole("button", { name: /book this court/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to browse/i })
    ).toBeInTheDocument();
  });

  it("calls router.back when Back to Browse is clicked", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => mockCourt });
    render(<CourtDetailPage />);
    const btn = await screen.findByRole("button", { name: /back to browse/i });
    fireEvent.click(btn);
    expect(mockBack).toHaveBeenCalled();
  });
});
