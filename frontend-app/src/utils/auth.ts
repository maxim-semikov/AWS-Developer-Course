export const setAuthorizationToken = (githubLogin: string) => {
  try {
    const text = `${githubLogin}:TEST_PASSWORD`;
    const bytes = new TextEncoder().encode(text);
    const token = btoa(String.fromCharCode(...bytes));
    localStorage.setItem("authorization_token", token);
    return token;
  } catch (error) {
    console.log("error", error);
  }
};

export const getAuthorizationToken = () => {
  return localStorage.getItem("authorization_token");
};
