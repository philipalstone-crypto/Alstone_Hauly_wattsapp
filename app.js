/* Alstone_Hauly Wattsapp starter.
   Uses Supabase Auth + Postgres RLS. Never place secret/service_role keys here. */
const $ = id => document.getElementById(id);
let supabaseClient = null;
let currentUser = null;
let realtimeChannel = null;
let loadingMessages = false;

function show(id, visible) { $(id).classList.toggle("hidden", !visible); }
function status(text) { $("status").textContent = text; }
function authMsg(text) { $("authMessage").textContent = text; }
function chatMsg(text) { $("chatMessage").textContent = text; }

function cleanPhone(value) { return value.trim().replace(/[ ()-]/g, ""); }
function validPhone(value) { return /^\+[1-9]\d{7,14}$/.test(value); }

function connect(url, key) {
  if (!window.supabase?.createClient) throw new Error("Supabase library did not load. Check your internet connection and reload.");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) throw new Error("Enter your Supabase project URL.");
  supabaseClient = window.supabase.createClient(url.replace(/\/$/, ""), key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  localStorage.setItem("ah_supabase_url", url);
  localStorage.setItem("ah_supabase_key", key);
  show("setup", false); show("auth", true);
  status("Connected");
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    renderAuth();
  });
  supabaseClient.auth.getSession().then(({data, error}) => {
    if (error) authMsg(error.message);
    currentUser = data?.session?.user || null;
    renderAuth();
  });
}
function renderAuth() {
  const signedIn = !!currentUser;
  show("messenger", signedIn);
  show("signOut", signedIn);
  if (signedIn) {
    $("signedInAs").textContent = currentUser.phone || "Signed in";
    status("Signed in");
    loadMessages();
  } else {
    status(supabaseClient ? "Connected" : "Not connected");
  }
}
async function sendOtp() {
  if (!supabaseClient) return authMsg("Connect your Supabase project first.");
  const phone = cleanPhone($("phone").value);
  if (!validPhone(phone)) return authMsg("Enter a valid number in international format, e.g. +2547XXXXXXXX.");
  authMsg("Requesting verification code…");
  const {error} = await supabaseClient.auth.signInWithOtp({phone});
  authMsg(error ? error.message : "If the number is eligible, a verification code has been sent.");
}
async function verifyOtp() {
  const phone = cleanPhone($("phone").value), token = $("otp").value.trim();
  if (!validPhone(phone)) return authMsg("Enter your phone number in international format first.");
  if (!token) return authMsg("Enter the verification code you received.");
  authMsg("Verifying…");
  const {error} = await supabaseClient.auth.verifyOtp({phone, token, type:"sms"});
  authMsg(error ? error.message : "Phone verified. You are signed in.");
}
async function loadMessages() {
  if (!currentUser || loadingMessages) return;
  const recipient = cleanPhone($("recipient").value);
  if (!validPhone(recipient)) {
    $("messages").innerHTML = '<p class="empty">Enter the other Alstone_Hauly user’s full phone number to load the conversation.</p>';
    return;
  }
  loadingMessages = true;
  try {
    const {data: profile, error: pErr} = await supabaseClient
      .from("profiles").select("id,phone").eq("phone", recipient).maybeSingle();
    if (pErr) throw pErr;
    if (!profile) {
      $("messages").innerHTML = '<p class="empty">No registered Alstone_Hauly account found for that number yet.</p>';
      return;
    }
    const {data, error} = await supabaseClient.from("messages").select("id,sender_id,recipient_id,body,created_at")
      .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${profile.id}),and(sender_id.eq.${profile.id},recipient_id.eq.${currentUser.id})`)
      .order("created_at", {ascending:true}).limit(200);
    if (error) throw error;
    renderMessages(data || []);
    if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = supabaseClient.channel("ah-messages-" + [currentUser.id,profile.id].sort().join("-"))
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"}, payload => {
        if ([payload.new.sender_id,payload.new.recipient_id].includes(currentUser.id) &&
            [payload.new.sender_id,payload.new.recipient_id].includes(profile.id)) loadMessages();
      }).subscribe();
  } catch(e) {
    $("messages").innerHTML = '<p class="empty">Could not load messages. Check the SQL setup and database policies.</p>';
    chatMsg(e.message || "Could not load messages.");
  } finally { loadingMessages = false; }
}
function renderMessages(rows) {
  const container = $("messages"); container.replaceChildren();
  if (!rows.length) {
    const p = document.createElement("p"); p.className="empty"; p.textContent="No messages yet. Say hello!"; container.append(p); return;
  }
  for (const row of rows) {
    const div = document.createElement("div");
    div.className = "bubble" + (row.sender_id === currentUser.id ? " mine" : "");
    const body = document.createElement("div"); body.textContent = row.body;
    const meta = document.createElement("small"); meta.textContent = new Date(row.created_at).toLocaleString();
    div.append(body,meta); container.append(div);
  }
  container.scrollTop = container.scrollHeight;
}
async function sendMessage(event) {
  event.preventDefault();
  if (!currentUser) return chatMsg("Sign in first.");
  const recipient = cleanPhone($("recipient").value);
  const body = $("messageText").value.trim();
  if (!validPhone(recipient)) return chatMsg("Enter a valid recipient number.");
  if (!body) return;
  const {data: profile, error: pErr} = await supabaseClient.from("profiles").select("id").eq("phone",recipient).maybeSingle();
  if (pErr) return chatMsg(pErr.message);
  if (!profile) return chatMsg("That person must register in Alstone_Hauly first.");
  const {error} = await supabaseClient.from("messages").insert({
    sender_id: currentUser.id, recipient_id: profile.id, body
  });
  if (error) return chatMsg(error.message);
  $("messageText").value = ""; chatMsg("Message sent."); loadMessages();
}
$("saveConfig").addEventListener("click", () => {
  try { connect($("supabaseUrl").value.trim(), $("supabaseKey").value.trim()); }
  catch(e) { alert(e.message); }
});
$("sendOtp").addEventListener("click", sendOtp);
$("verifyOtp").addEventListener("click", verifyOtp);
$("signOut").addEventListener("click", async () => {
  await supabaseClient.auth.signOut(); currentUser = null; renderAuth(); authMsg("Signed out.");
});
$("refresh").addEventListener("click", loadMessages);
$("recipient").addEventListener("change", loadMessages);
$("sendForm").addEventListener("submit", sendMessage);

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
const savedUrl = localStorage.getItem("ah_supabase_url");
const savedKey = localStorage.getItem("ah_supabase_key");
if (savedUrl && savedKey) {
  $("supabaseUrl").value = savedUrl; $("supabaseKey").value = savedKey;
  try { connect(savedUrl,savedKey); } catch(e) { console.warn(e); }
}
