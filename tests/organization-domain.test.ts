import {
 emailDomainToOrganizationName,
 emailDomainToOrganizationSlug,
 extractEmailDomain,
 isPersonalEmailDomain,
 personalOrganizationName,
 personalOrganizationSlug,
 resolveOrganizationIdentity
} from "@vessify/domain";


describe("organization domain helpers", () => {
 it("extracts email domain", () => {
   expect(extractEmailDomain("alice@google.com")).toBe("google.com");
   expect(extractEmailDomain("Bob@Uber.COM")).toBe("uber.com");
 });


 it("maps domain to stable organization slug", () => {
   expect(emailDomainToOrganizationSlug("google.com")).toBe("google-com");
   expect(emailDomainToOrganizationSlug("uber.com")).toBe("uber-com");
 });


 it("maps domain to organization name", () => {
   expect(emailDomainToOrganizationName("google.com")).toBe("Google Organization");
   expect(emailDomainToOrganizationName("uber.com")).toBe("Uber Organization");
 });


 it("detects personal email domains", () => {
   expect(isPersonalEmailDomain("gmail.com")).toBe(true);
   expect(isPersonalEmailDomain("yahoo.com")).toBe(true);
   expect(isPersonalEmailDomain("google.com")).toBe(false);
   expect(isPersonalEmailDomain("uber.com")).toBe(false);
 });


 it("creates unique personal organization identity", () => {
   const identity = resolveOrganizationIdentity("alice@gmail.com", "user_abc123xyz", "Alice");


   expect(identity.sharedByDomain).toBe(false);
   expect(identity.slug).toBe(personalOrganizationSlug("user_abc123xyz"));
   expect(identity.name).toBe(personalOrganizationName("Alice"));
 });


 it("creates shared corporate organization identity", () => {
   const identity = resolveOrganizationIdentity("alice@google.com", "user_abc123xyz", "Alice");


   expect(identity.sharedByDomain).toBe(true);
   expect(identity.slug).toBe("google-com");
   expect(identity.name).toBe("Google Organization");
 });
});
