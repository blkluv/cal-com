import axios from "axios";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { withPaymentInterceptor, decodeXPaymentResponse } from "x402-axios";
import dotenv from "dotenv";
dotenv.config();

const baseURL = "http://localhost:4020"; // e.g. https://example.com
const endpointPath = "/get-data";
console.log(process.env.PRIVATE_KEY);

const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
const api = withPaymentInterceptor(
  axios.create({
    baseURL,
  }),
  account
);

api
  .get(endpointPath)
  .then((response) => {
    console.log("inside api");
    console.log(response.data);

    const paymentResponse = decodeXPaymentResponse(
      response.headers["x-payment-response"]
    );
    console.log("inside payment response");
    console.log(paymentResponse);
  })
  .catch((error) => {
    console.log("error", error);
    console.error(error.response?.data);
  });
