import { render } from "@testing-library/react";
import HomePage from "./page";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));
// Mock firebase modules to prevent real initialization
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({}));
jest.mock("@/src/lib/firebase", () => ({}));
jest.mock("@/src/lib/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

describe("HomePage", () => {
  it("redirects to /courts on mount", () => {
    render(<HomePage />);
    expect(mockReplace).toHaveBeenCalledWith("/courts");
  });
});
