const request = require("supertest");
const app = require("../app");
const db = require("../src/config/database");

describe("Authentication Endpoints Flow", () => {
  it("should fail to register a user if password parameters are missing", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "testuser@warehouse.com",
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual("Name, email, and password are required");
  });
});
