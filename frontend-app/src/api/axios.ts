import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

const handleError = (error: any) => {
  if (error.response) {
    switch (error.response.status) {
      case 401:
        return "401 (Unauthorized) - please set token to localStorage";
      case 403:
        return "403 (Forbidden) - you don't have permission";
      case 500:
        return "500: Internal server error";
      default:
        return error.response.data?.message || "An error occurred";
    }
  } else if (error.request) {
    return "Network error - please check your connection";
  } else {
    return "An unexpected error occurred";
  }
};

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMessage = handleError(error);
    if (errorMessage) {
      window.dispatchEvent(
        new CustomEvent("showError", { detail: errorMessage })
      );
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
