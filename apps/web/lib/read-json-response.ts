export async function readJsonResponse(response: Response) {
 const text = await response.text();


 if (!text) {
   return {};
 }


 try {
   return JSON.parse(text) as unknown;
 } catch {
   return { error: text };
 }
}





