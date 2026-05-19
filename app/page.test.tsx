import { render, screen } from "@testing-library/react";
import HomePage from "./page";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/",
}));
// Mock firebase modules to prevent real initialization
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({}));
jest.mock("@/lib/firebase", () => ({}));
jest.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
jest.mock("@/components/AppHeader", () => function MockAppHeader() {
  return <div data-testid="app-header" />;
});
jest.mock("@/lib/useCourtListings", () => ({
  useCourtListings: () => ({ courts: [], loading: false, error: "" }),
  toCourtCardModel: (court: unknown) => court,
}));

describe("HomePage", () => {
  it("renders the public court search landing page", () => {
    render(<HomePage />);
    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByText("Featured Courts")).toBeInTheDocument();
    expect(screen.getByText("No courts found.")).toBeInTheDocument();
  });
});
