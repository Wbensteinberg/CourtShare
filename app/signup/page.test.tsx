import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import SignupPage from "./page";

jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  createUserWithEmailAndPassword: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/src/lib/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "test@example.com", uid: "testuid" },
    loading: false,
    isOwner: false,
    setIsOwner: jest.fn(),
  }),
}));

describe("SignupPage", () => {
  it("renders signup form", () => {
    render(<SignupPage />);
    expect(screen.getByText(/CourtShare/i)).toBeInTheDocument();
    expect(screen.getByText(/Create your account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^Password$/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Confirm Password/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sign Up/i })
    ).toBeInTheDocument();
  });

  it("shows error if passwords do not match", async () => {
    render(<SignupPage />);
    fireEvent.change(screen.getByPlaceholderText(/Email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Password$/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), {
      target: { value: "differentpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));
    expect(
      await screen.findByText(/Passwords do not match/i)
    ).toBeInTheDocument();
  });
});
