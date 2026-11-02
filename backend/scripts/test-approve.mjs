async function test() {
  console.log("Logging in as Admin...");
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@chainverify.com", password: "admin123" })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log("Token:", token);

  console.log("Fetching pending documents...");
  const pendingRes = await fetch("http://localhost:5000/api/management/pending", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const pendingData = await pendingRes.json();
  console.log("Pending documents:", pendingData.items?.length);

  if (pendingData.items && pendingData.items.length > 0) {
    const docId = pendingData.items[0]._id;
    console.log("Attempting to approve document:", docId);
    
    const approveRes = await fetch(`http://localhost:5000/api/management/approve/${docId}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const approveData = await approveRes.json();
    console.log("Approve response:", approveRes.status, approveData);
  }
}

test();
