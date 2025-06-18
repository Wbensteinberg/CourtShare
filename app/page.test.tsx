import { render, screen } from "@testing-library/react";
import HomePage from "./page";

jest.mock("../src/lib/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const { useAuth } = require("../src/lib/AuthContext");

jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(),
}));

describe("HomePage", () => {
  it("shows loading state", () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    render(<HomePage />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("shows logged in state", () => {
    useAuth.mockReturnValue({
      user: { email: "test@example.com" },
      loading: false,
    });
    render(<HomePage />);
    expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/You are logged in/i)).toBeInTheDocument();
  });

  it("shows logged out state", () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(<HomePage />);
    expect(screen.getByText(/You are not logged in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Log In/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign Up/i })).toBeInTheDocument();
  });
});
