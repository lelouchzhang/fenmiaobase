import axios from "axios";

const apiClient = axios.create({
  withCredentials: true,
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL,
});

export default apiClient;
