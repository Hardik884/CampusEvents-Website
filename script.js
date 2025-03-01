import { firebaseConfig, CLOUD_NAME, UPLOAD_PRESET } from "./config.js";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
provider.addScope("profile");
provider.addScope("email");

// Now you can use CLOUD_NAME and UPLOAD_PRESET
console.log("Cloudinary Config:", CLOUD_NAME, UPLOAD_PRESET);

  // Theme Toggle
  const themeToggle = document.getElementById("themeToggle")
  
  // Check for saved theme preference or respect OS preference
  const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)")
  const savedTheme = localStorage.getItem("theme")
  
  if (savedTheme === "dark" || (!savedTheme && prefersDarkScheme.matches)) {
    document.body.classList.add("dark-mode")
    themeToggle.checked = true
  }
  
  // Toggle theme when the switch is clicked
  themeToggle.addEventListener("change", function () {
    if (this.checked) {
      document.body.classList.add("dark-mode")
      localStorage.setItem("theme", "dark")
    } else {
      document.body.classList.remove("dark-mode")
      localStorage.setItem("theme", "light")
    }
  })
  
  let selectedEventId = null; // Store event ID when clicking register
  
  // Handle Register Button Click (Open Confirmation Modal)
  document.addEventListener("click", function (event) {
      if (event.target.classList.contains("register-btn")) {
          if (!auth.currentUser) {
              showToast("Please sign in to register!", false);
              return;
          }
          selectedEventId = event.target.getAttribute("data-id");
          openModal("registerConfirmModal");
      }
  });
  
  // Confirm Registration & Store in Firestore
  document.getElementById("confirmRegisterBtn").addEventListener("click", async function () {
      if (!selectedEventId) return;
  
      const currentUser = auth.currentUser;
      if (!currentUser) {
          showToast("Please sign in to register!", false);
          return;
      }
  
      const { name, regNo } = extractStudentDetails(currentUser.email);
      console.log("✅ Registering:", name, regNo, "for event", selectedEventId);
  
      try {
          const eventRef = db.collection("events").doc(selectedEventId);
          const eventDoc = await eventRef.get();
  
          if (!eventDoc.exists) {
              showToast("Event not found!", false);
              return;
          }
  
          const eventData = eventDoc.data();
          const seatsLeft = eventData.capacity - (eventData.registeredUsers ? eventData.registeredUsers.length : 0);
  
          if (seatsLeft <= 0) {
              showToast("No seats left for this event!", false);
              return;
          }
  
          await eventRef.update({
              registeredUsers: firebase.firestore.FieldValue.arrayUnion({ name, regNo })
          });
  
          showToast("Successfully registered!");
          closeModal("registerConfirmModal");
          updateRegisterButton(selectedEventId);
          updateSeatsLeft(selectedEventId);
  
      } catch (error) {
          console.error("❌ Error registering for event:", error);
          showToast("Error registering: " + error.message, false);
      }
  });
  
  // Update Register Button After Successful Registration
  function updateRegisterButton(eventId) {
      const button = document.querySelector(`.register-btn[data-id="${eventId}"]`);
      if (button) {
          button.textContent = "Registered";
          button.disabled = true;
          button.classList.remove("btn-primary");
          button.classList.add("btn-outline");
      }
  }
  
  // Update "Seats Left" in UI
  async function updateSeatsLeft(eventId) {
      const eventRef = db.collection("events").doc(eventId);
      const eventDoc = await eventRef.get();
      
      if (eventDoc.exists) {
          const eventData = eventDoc.data();
          const seatsLeft = eventData.capacity - (eventData.registeredUsers ? eventData.registeredUsers.length : 0);
          
          const seatsElement = document.querySelector(`.event-card[data-id="${eventId}"] .seats-left strong`);
          if (seatsElement) {
              seatsElement.textContent = seatsLeft;
          }
  
          const registerBtn = document.querySelector(`.register-btn[data-id="${eventId}"]`);
          if (registerBtn) {
              if (seatsLeft <= 0) {
                  registerBtn.textContent = "No Seats Left";
                  registerBtn.disabled = true;
                  registerBtn.classList.remove("btn-primary");
                  registerBtn.classList.add("btn-outline");
              }
          }
      }
  }
  
  
  
  // Ensure "Create Event" button opens the modal
  document.addEventListener("DOMContentLoaded", function () {
      const createEventBtn = document.getElementById("createEventBtn");
      const createEventModal = document.getElementById("createEventModal");
  
      if (createEventBtn && createEventModal) {
          createEventBtn.addEventListener("click", () => {
              console.log("✅ Create Event button clicked! Opening modal...");
              openModal("createEventModal");
          });
      } else {
          console.error("❌ Create Event button or modal not found!");
      }
  });
  
  
  // Extract Name and Registration Number from VIT Email
  function extractStudentDetails(email) {
      if (!email.endsWith('@vitstudent.ac.in')) return null;
  
      const emailPrefix = email.split('@')[0];
      const namePart = emailPrefix.replace(/[0-9]+$/, '').replace('.', ' '); 
      const regNoMatch = emailPrefix.match(/[0-9]{2}[A-Z]{3}[0-9]{4}$/);
  
      const regNo = regNoMatch ? regNoMatch[0] : ''; 
      return { name: namePart, regNo: regNo };
  }
  
  // Handle User Authentication
  auth.onAuthStateChanged(async (user) => {
      const authButton = document.getElementById("authButton");
  
      if (user) {
          const email = user.email;
          if (!email.endsWith('@vitstudent.ac.in')) {
              auth.signOut();
              showToast("Only VIT students can sign in!", false);
              return;
          }
  
          const { name, regNo } = extractStudentDetails(email);
          console.log("Extracted Name:", name);
          console.log("Extracted Registration No:", regNo);
  
          try {
              await db.collection("users").doc(user.uid).set({
                  name: name,
                  regNo: regNo,
                  email: email,
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
              console.log("User saved in Firestore!");
          } catch (error) {
              console.error("Error writing to Firestore:", error);
          }
  
          authButton.textContent = "Sign Out";
          showToast(`Welcome, ${name}!`);
      } else {
          authButton.textContent = "Sign In";
      }
  });
  
  // Handle Sign In/Out Button Click
  document.getElementById("authButton").addEventListener("click", () => {
      if (auth.currentUser) {
          auth.signOut().then(() => showToast("Signed out successfully!"));
      } else {
          auth.signInWithPopup(provider).catch((error) => showToast("Error signing in: " + error.message, false));
      }
  });
  
  // Handle Event Creation (Cloudinary Upload)
  document.getElementById("createEventForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      const submitButton = this.querySelector('button[type="submit"]');
      
      try {
          submitButton.disabled = true;
          submitButton.innerHTML = '<span class="spinner"></span> Creating Event...';
  
          if (!auth.currentUser) {
              showToast("Please sign in to create events", false);
              return;
          }
  
          // Extract form values
          const { name, regNo } = extractStudentDetails(auth.currentUser.email);
          const title = document.getElementById("eventTitle").value;
          const category = document.getElementById("eventCategory").value;
          const organizerName = document.getElementById("organizerName").value;
          const startDate = document.getElementById("startDate").value;
          const endDate = document.getElementById("endDate").value;
          const startTime = document.getElementById("startTime").value;
          const endTime = document.getElementById("endTime").value;
          const venue = document.getElementById("eventVenue").value;
          const description = document.getElementById("eventDescription").value;
          const capacity = Number(document.getElementById("eventCapacity").value);
          const imageFile = document.getElementById("eventImage").files[0];
  
          // Validation
          if (!title || !category || !organizerName || !startDate || !endDate || !startTime || !endTime || !venue || !description || !capacity) {
              showToast("Please fill all event details!", false);
              return;
          }
  
          if (new Date(startDate) > new Date(endDate)) {
              showToast("End date must be after start date!", false);
              return;
          }
  
          if (!imageFile) {
              showToast("Please upload an event image", false);
              return;
          }
  
          // Date formatting
          const formatDate = (dateString) => {
              const date = new Date(dateString);
              return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
          };
  
          // Upload image to Cloudinary
          const formData = new FormData();
          formData.append('file', imageFile);
          formData.append('upload_preset', UPLOAD_PRESET);
          formData.append('cloud_name', CLOUD_NAME);
  
          const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
              method: 'POST',
              body: formData
          });
  
          if (!response.ok) throw new Error('Image upload failed');
          const imageData = await response.json();
  
          // Save event to Firestore
          await db.collection("events").add({
              title,
              category,
              organizerName,
              startDate: formatDate(startDate),
              endDate: formatDate(endDate),
              startTime,
              endTime,
              venue,
              description,
              capacity,
              registeredUsers: [],
              imageUrl: imageData.secure_url,
              createdBy: name, // Original user name from VIT email
              regNo,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
  
          showToast("Event created successfully!");
          closeModal("createEventModal");
          this.reset();
  
      } catch (error) {
          console.error("Error creating event:", error);
          showToast("Error creating event: " + error.message, false);
      } finally {
          submitButton.disabled = false;
          submitButton.textContent = "Create Event";
      }
  });
  
  // Utility Functions
  function showToast(message, isSuccess = true) {
      const toast = document.getElementById("toast");
      const toastIcon = document.querySelector(".toast-icon");
      const toastMessage = document.querySelector(".toast-message");
  
      toastIcon.className = isSuccess ? "fas fa-check-circle toast-icon success" : "fas fa-times-circle toast-icon error";
      toastMessage.textContent = message;
      toast.classList.add("show");
  
      setTimeout(() => toast.classList.remove("show"), 3000);
  }
  
  function closeAllModals() {
      document.querySelectorAll(".modal").forEach((modal) => {
          modal.style.display = "none";
          document.body.style.overflow = "auto";
      });
  }
  
  // Load Events When Page is Ready
  document.addEventListener("DOMContentLoaded", function () {
      console.log("Page Loaded: Loading events...");
      loadEvents();
  });
  
  function loadEvents() {
      const eventsContainer = document.getElementById("eventsContainer");
  
      db.collection("events").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
          eventsContainer.innerHTML = "";
  
          if (snapshot.empty) {
              console.warn("⚠️ No events found in Firestore.");
              eventsContainer.innerHTML = "<p>No events available.</p>";
              return;
          }
  
          snapshot.forEach((doc) => {
              const event = doc.data();
              const eventId = doc.id;
              const currentUser = auth.currentUser;
              let buttonsHTML = '';
  
              // Calculate remaining seats
              const seatsLeft = event.capacity - (event.registeredUsers ? event.registeredUsers.length : 0);
              const isFull = seatsLeft <= 0;
  
              let isAlreadyRegistered = false;
              if (currentUser && event.registeredUsers) {
                  const userDetails = extractStudentDetails(currentUser.email);
                  isAlreadyRegistered = event.registeredUsers.some(user => user.regNo === userDetails.regNo);
              }
  
              if (currentUser) {
                  const userDetails = extractStudentDetails(currentUser.email);
                  const isCreator = userDetails && event.createdBy === userDetails.name;
  
                  if (isCreator) {
                      buttonsHTML = `
                          <button class="btn btn-secondary delete-event-btn" data-id="${eventId}" data-img="${event.imageUrl}">Delete Event</button>
                          <button class="btn btn-outline view-users-btn" data-id="${eventId}">See Registered Users</button>
                      `;
                  } else {
                      buttonsHTML = isFull 
                          ? `<button class="btn btn-outline full-btn" disabled>No Seats Left</button>`
                          : isAlreadyRegistered
                              ? `<button class="btn btn-outline registered-btn" disabled>Registered</button>`
                              : `<button class="btn btn-primary register-btn" data-id="${eventId}">Register</button>`;
                  }
              } else {
                  buttonsHTML = `<button class="btn btn-primary register-btn" data-id="${eventId}">Register</button>`;
              }
  
              const eventHTML = `
                  <div class="event-card">
                      <div class="event-image">
                          <img src="${event.imageUrl}" alt="${event.title}">
                      </div>
                      <div class="event-details">
                          <h3>${event.title}</h3>
                          <p>${event.description}</p>
                          <span>📍 ${event.venue}</span>
                          <div class="event-timings">
                              <p>🗓 ${event.startDate} - ${event.endDate}</p>
                              <p>⏰ ${event.startTime} - ${event.endTime}</p>
                          </div>
                          <p>Organized by: ${event.organizerName}</p>
                          <p class="seats-left">🪑 Seats Left: <strong>${seatsLeft}</strong></p>
                          <div class="event-actions">${buttonsHTML}</div>
                      </div>
                  </div>`;
              
              eventsContainer.innerHTML += eventHTML;
          });
  
          // Attach event listeners for delete buttons
          document.querySelectorAll(".delete-event-btn").forEach(button => {
              button.addEventListener("click", function () {
                  const eventId = this.getAttribute("data-id");
                  const imageUrl = this.getAttribute("data-img");
                  confirmDeleteEvent(eventId, imageUrl);
              });
          });
      });
  }
  
  
  async function deleteEvent(eventId, imageUrl) {
      try {
          // Delete the event from Firestore
          await db.collection("events").doc(eventId).delete();
          showToast("Event deleted successfully!");
  
          // Extract Cloudinary Public ID
          const publicId = imageUrl.split('/').pop().split('.')[0];
  
          // Delete image from Cloudinary
          const cloudinaryDeleteUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`;
          const formData = new FormData();
          formData.append('public_id', publicId);
          formData.append('api_key', "YOUR_CLOUDINARY_API_KEY");
  
          const response = await fetch(cloudinaryDeleteUrl, {
              method: 'POST',
              body: formData
          });
  
          if (response.ok) {
              console.log("✅ Image deleted from Cloudinary");
          } else {
              console.warn("⚠️ Could not delete image from Cloudinary");
          }
  
      } catch (error) {
          console.error("❌ Error deleting event:", error);
          showToast("Error deleting event: " + error.message, false);
      }
  }
  
  // Confirm Before Deleting Event
  function confirmDeleteEvent(eventId, imageUrl) {
      const confirmation = confirm("Are you sure you want to delete this event?");
      if (confirmation) {
          deleteEvent(eventId, imageUrl);
      }
  }
  
  
  // Fetch and Display Registered Users
  async function showRegisteredUsers(eventId) {
      try {
          console.log("📌 Fetching registered users for event:", eventId);
          const eventRef = await db.collection("events").doc(eventId).get();
          const eventData = eventRef.data();
  
          if (!eventData || !eventData.registeredUsers || eventData.registeredUsers.length === 0) {
              showToast("No users have registered for this event.", false);
              return;
          }
  
          const userList = document.getElementById("registeredUsersList");
          userList.innerHTML = ""; // Clear previous data
  
          eventData.registeredUsers.forEach(user => {
              const userItem = document.createElement("li");
              userItem.textContent = `${user.name}`;
              userList.appendChild(userItem);
          });
  
          openModal("registeredUsersModal");
      } catch (error) {
          console.error("❌ Error fetching registered users:", error);
          showToast("Error fetching users.", false);
      }
  }
  
  // Attach event listener to "See Registered Users" button
  document.addEventListener("click", function (event) {
      if (event.target.classList.contains("view-users-btn")) {
          const eventId = event.target.getAttribute("data-id");
          showRegisteredUsers(eventId);
      }
  });
  
  
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "block";
        document.body.style.overflow = "hidden";
    }
  }
  
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
  }
  