// All credentials stay in the HttpOnly session cookie. Only the CSRF token is in memory.
export const session = {user:null, csrfToken:null, aiEnabled:false};
export async function request(path, method='GET', body) {
  const headers = {Accept:'application/json'};
  if (body !== undefined) headers['Content-Type']='application/json';
  if (session.csrfToken) headers['X-CSRF-Token']=session.csrfToken;
  let response;
  try {response=await fetch('/api'+path,{method,headers,credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body)});}
  catch {throw Object.assign(new Error('Unable to reach the server.'),{code:'NETWORK_ERROR'});}
  let data;try {data=await response.json();}catch {throw Object.assign(new Error('Invalid server response.'),{code:'NETWORK_ERROR'});}
  if(!response.ok)throw Object.assign(new Error(data.error||'Request failed'),{code:data.code,status:response.status});
  return data;
}
