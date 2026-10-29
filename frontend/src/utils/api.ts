import axios from "axios";

/** Same-origin by default so Cloudflare Tunnel / production URLs work without hardcoding localhost */
export const api = axios.create({
  baseURL:
    typeof import.meta.env.VITE_API_URL === "string" &&
    import.meta.env.VITE_API_URL.length > 0
      ? import.meta.env.VITE_API_URL
      : "",
});
