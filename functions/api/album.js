import { album } from "../../shared/handlers.js";
export const onRequest = ({ request }) => album(request);
