const request = require("supertest");
const app = require("../app");
const db = require("../src/config/database");

describe("Authentication Endpoints Integration Lifecycle", () => {
  const testUser = {
    name: "Manaf Developer",
    email: "manaf@warehouse.com",
    password: "securePassword123",
    role: "staff",
  };

  it("should fail to register a user if password parameters are missing", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Manaf",
      email: "incomplete@warehouse.com",
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual("Name, email, and password are required");
  });

  it("should successfully register a new user with valid parameters", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(testUser);

    expect(res.statusCode).toEqual(201);
    expect(res.body.message).toEqual("User registered successfully");
    expect(res.body).toHaveProperty("userId");
  });

  it("should successfully authenticate an existing user and return a signed JWT token", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual("Login successful");
    expect(res.body).toHaveProperty("token");
  });

  it("should reject access to protected endpoints if a valid authorization header is missing", async () => {
    const res = await request(app).get("/api/v1/categories");

    expect(res.statusCode).toEqual(401);
  });
});
