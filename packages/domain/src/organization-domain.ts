const PERSONAL_EMAIL_DOMAINS = new Set([
 "aol.com",
 "gmail.com",
 "googlemail.com",
 "hotmail.com",
 "icloud.com",
 "live.com",
 "mac.com",
 "me.com",
 "msn.com",
 "outlook.com",
 "pm.me",
 "proton.me",
 "protonmail.com",
 "yahoo.com",
 "ymail.com"
]);


export function extractEmailDomain(email: string): string {
 const normalized = email.trim().toLowerCase();
 const atIndex = normalized.lastIndexOf("@");


 if (atIndex <= 0 || atIndex === normalized.length - 1) {
   throw new Error("Invalid email address");
 }


 return normalized.slice(atIndex + 1);
}


export function isPersonalEmailDomain(domain: string): boolean {
 return PERSONAL_EMAIL_DOMAINS.has(domain.trim().toLowerCase());
}


export function emailDomainToOrganizationSlug(domain: string): string {
 return domain
   .trim()
   .toLowerCase()
   .replace(/[^a-z0-9.]+/g, "-")
   .replace(/\./g, "-")
   .replace(/-+/g, "-")
   .replace(/^-|-$/g, "");
}


export function personalOrganizationSlug(userId: string): string {
 return `${userId.slice(0, 12)}-workspace`;
}


export function emailDomainToOrganizationName(domain: string): string {
 const rootLabel = domain.trim().toLowerCase().split(".")[0] ?? domain;
 const formatted = rootLabel.charAt(0).toUpperCase() + rootLabel.slice(1);
 return `${formatted} Organization`;
}


export function personalOrganizationName(displayName?: string): string {
 const trimmed = displayName?.trim();
 if (trimmed) {
   return `${trimmed} Workspace`;
 }


 return "Personal Workspace";
}


export type OrganizationIdentity = {
 domain: string;
 slug: string;
 name: string;
 sharedByDomain: boolean;
};


export function resolveOrganizationIdentity(
 email: string,
 userId: string,
 displayName?: string
): OrganizationIdentity {
 const domain = extractEmailDomain(email);


 if (isPersonalEmailDomain(domain)) {
   return {
     domain,
     slug: personalOrganizationSlug(userId),
     name: personalOrganizationName(displayName),
     sharedByDomain: false
   };
 }


 return {
   domain,
   slug: emailDomainToOrganizationSlug(domain),
   name: emailDomainToOrganizationName(domain),
   sharedByDomain: true
 };
}
