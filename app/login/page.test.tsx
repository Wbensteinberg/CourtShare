import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve()),
}));

jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(),
}));

describe("LoginPage", () => {
  it("renders login form", () => {
    render(<LoginPage />);
    expect(screen.getByText(/CourtShare/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sign In/i })
    ).toBeInTheDocument();
  });

  it("allows user to type email and password and submit", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText(/Email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sign In/i })).toBeEnabled();
    });
  });
});
