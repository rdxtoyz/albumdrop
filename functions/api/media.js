import { media } from "../../shared/handlers.js";
export const onRequest = ({ request }) => media(request);
