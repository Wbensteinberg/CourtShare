import {
  render,
  screen,
} from "@testing-library/react";
import LoginPage from "./page";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: jest.fn(() => null) }),
  usePathname: () => "/login",
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(() =>
    Promise.resolve({
      user: {
        uid: "testuid",
        email: "test@example.com",
        displayName: "Test User",
      },
    })
  ),
}));

jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
  getStorageInstance: jest.fn(() => ({})),
}));

jest.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    isOwner: false,
    setIsOwner: jest.fn(),
  }),
}));

describe("LoginPage", () => {
  it("renders login form", () => {
    render(<LoginPage />);
    expect(screen.getByText(/Sign in securely with Google/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue with Google/i })
    ).toBeInTheDocument();
  });
});
