import { Hono } from "hono";
import { html } from "hono/html";

const adminPortalRouter = new Hono();

// Admin password (in production, this should be hashed and stored securely)
const ADMIN_PASSWORD = "1234";

// POST /admin/verify-password - Verify admin password
adminPortalRouter.post("/verify-password", async (c) => {
  const { password } = await c.req.json();
  if (password === ADMIN_PASSWORD) {
    return c.json({ success: true });
  }
  return c.json({ success: false, error: "Invalid password" }, 401);
});

// GET /admin - Serve the admin portal HTML
adminPortalRouter.get("/", (c) => {
  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Arrive Alive Tour - Admin Portal</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: #0f0f0f;
          color: #e0e0e0;
          min-height: 100vh;
        }

        .login-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }

        .login-box {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
        }

        .login-box h1 {
          color: #fff;
          margin-bottom: 8px;
          font-size: 24px;
        }

        .login-box p {
          color: #888;
          margin-bottom: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #aaa;
          font-size: 14px;
        }

        .form-group input, .form-group select, .form-group textarea {
          width: 100%;
          padding: 12px 16px;
          background: #252525;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 16px;
        }

        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
          outline: none;
          border-color: #4a9eff;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .btn-primary {
          background: #4a9eff;
          color: #fff;
          width: 100%;
        }

        .btn-primary:hover {
          background: #3a8eef;
        }

        .btn-secondary {
          background: #333;
          color: #fff;
        }

        .btn-secondary:hover {
          background: #444;
        }

        .btn-danger {
          background: #dc3545;
          color: #fff;
        }

        .btn-danger:hover {
          background: #c82333;
        }

        .btn-success {
          background: #28a745;
          color: #fff;
        }

        .btn-success:hover {
          background: #218838;
        }

        .btn-info {
          background: #17a2b8;
          color: #fff;
        }

        .btn-info:hover {
          background: #138496;
        }

        .error-message {
          color: #ff6b6b;
          margin-top: 12px;
          text-align: center;
        }

        /* Dashboard Styles */
        .dashboard {
          display: none;
        }

        .header {
          background: #1a1a1a;
          border-bottom: 1px solid #2a2a2a;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header h1 {
          color: #fff;
          font-size: 20px;
        }

        .tabs {
          display: flex;
          background: #1a1a1a;
          border-bottom: 1px solid #2a2a2a;
          padding: 0 24px;
        }

        .tab {
          padding: 16px 24px;
          color: #888;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #ccc;
        }

        .tab.active {
          color: #4a9eff;
          border-bottom-color: #4a9eff;
        }

        .content {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .tab-content {
          display: none;
        }

        .tab-content.active {
          display: block;
        }

        .card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .card h2 {
          color: #fff;
          margin-bottom: 16px;
          font-size: 18px;
        }

        .card h3 {
          color: #ccc;
          margin-bottom: 12px;
          font-size: 16px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #2a2a2a;
        }

        th {
          color: #888;
          font-weight: 500;
          font-size: 14px;
        }

        td {
          color: #e0e0e0;
        }

        tr:hover {
          background: #252525;
        }

        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-success {
          background: rgba(40, 167, 69, 0.2);
          color: #28a745;
        }

        .badge-warning {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
        }

        .badge-danger {
          background: rgba(220, 53, 69, 0.2);
          color: #dc3545;
        }

        .badge-info {
          background: rgba(74, 158, 255, 0.2);
          color: #4a9eff;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 20px;
        }

        .stat-card h3 {
          color: #888;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .stat-card .value {
          color: #fff;
          font-size: 32px;
          font-weight: 600;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 14px;
        }

        .modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal.active {
          display: flex;
        }

        .modal-content {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 24px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-header h2 {
          color: #fff;
          font-size: 20px;
        }

        .modal-close {
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
        }

        .modal-close:hover {
          color: #fff;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .checkbox-group {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .checkbox-item input {
          width: 18px;
          height: 18px;
        }

        .filter-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .filter-row .form-group {
          margin-bottom: 0;
          min-width: 200px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #888;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .text-muted {
          color: #666;
        }
      </style>
    </head>
    <body>
      <!-- Login Screen -->
      <div class="login-container" id="loginScreen">
        <div class="login-box">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="/public/aat-logo.png" alt="Arrive Alive Tour" style="max-width: 200px; height: auto;">
          </div>
          <h1>Arrive Alive Tour</h1>
          <p>Admin Portal</p>
          <form id="loginForm">
            <div class="form-group">
              <label for="username">Username</label>
              <input type="text" id="username" placeholder="Enter username" required>
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" placeholder="Enter password" required>
            </div>
            <button type="submit" class="btn btn-primary">Sign In</button>
            <p class="error-message" id="loginError" style="display: none;"></p>
            <p id="legacyHint" style="display: none; font-size: 12px; color: #888; margin-top: 12px; text-align: center;">
              First time? Use username: admin, password: 1234
            </p>
          </form>
        </div>
      </div>

      <!-- Dashboard -->
      <div class="dashboard" id="dashboard">
        <header class="header">
          <div style="display: flex; align-items: center; gap: 16px;">
            <img src="/public/aat-logo.png" alt="Arrive Alive Tour" style="height: 40px; width: auto;">
            <h1>Arrive Alive Tour Admin</h1>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="logout()">Logout</button>
        </header>

        <nav class="tabs">
          <div class="tab active" data-tab="teams">Teams</div>
          <div class="tab" data-tab="events">Events</div>
          <div class="tab" data-tab="overlays">Overlays</div>
          <div class="tab" data-tab="surveys">Surveys</div>
          <div class="tab" data-tab="data">Data</div>
          <div class="tab" data-tab="settings">Settings</div>
        </nav>

        <main class="content">
          <!-- Teams Tab -->
          <div class="tab-content active" id="teamsTab">
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Tour Teams</h2>
                <button class="btn btn-primary btn-sm" onclick="openTeamModal()">Add Team</button>
              </div>
              <div id="teamsLoading" class="loading">Loading teams...</div>
              <table id="teamsTable" style="display: none;">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="teamsBody"></tbody>
              </table>
              <div id="teamsEmpty" class="empty-state" style="display: none;">No teams found. Create your first team!</div>
            </div>
          </div>

          <!-- Events Tab -->
          <div class="tab-content" id="eventsTab">
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Events</h2>
                <button class="btn btn-primary btn-sm" onclick="openEventModal()">Add Event</button>
              </div>
              <div class="filter-row">
                <div class="form-group">
                  <label for="eventTeamFilter">Filter by Team</label>
                  <select id="eventTeamFilter" onchange="loadEvents()">
                    <option value="">All Teams</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="eventStatusFilter">Status</label>
                  <select id="eventStatusFilter" onchange="loadEvents()">
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div id="eventsLoading" class="loading">Loading events...</div>
              <table id="eventsTable" style="display: none;">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Location</th>
                    <th>Date</th>
                    <th>Photo Deletion</th>
                    <th>Team</th>
                    <th>Status</th>
                    <th>Surveys</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="eventsBody"></tbody>
              </table>
              <div id="eventsEmpty" class="empty-state" style="display: none;">No events found.</div>
            </div>
          </div>

          <!-- Overlays Tab -->
          <div class="tab-content" id="overlaysTab">
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Photo Overlays</h2>
                <button class="btn btn-primary btn-sm" onclick="openOverlayModal()">Add Overlay</button>
              </div>
              <div id="overlaysLoading" class="loading">Loading overlays...</div>
              <table id="overlaysTable" style="display: none;">
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>Name</th>
                    <th>Filename</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="overlaysBody"></tbody>
              </table>
              <div id="overlaysEmpty" class="empty-state" style="display: none;">No overlays found. Upload your first overlay!</div>
            </div>
          </div>

          <!-- Surveys Tab -->
          <div class="tab-content" id="surveysTab">
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Survey Types</h2>
                <button class="btn btn-primary btn-sm" onclick="openSurveyModal()">Add Survey</button>
              </div>
              <div class="form-group" style="margin-bottom: 16px;">
                <label class="checkbox-item">
                  <input type="checkbox" id="showInactiveSurveys" onchange="loadSurveyTypes()">
                  Show inactive surveys
                </label>
              </div>
              <div id="surveyTypesLoading" class="loading">Loading survey types...</div>
              <table id="surveyTypesTable" style="display: none;">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Questions</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="surveyTypesBody"></tbody>
              </table>
              <div id="surveyTypesEmpty" class="empty-state" style="display: none;">No survey types found. Create your first survey!</div>
            </div>
          </div>

          <!-- Data Tab -->
          <div class="tab-content" id="dataTab">
            <div class="stats-grid" id="statsGrid">
              <div class="stat-card">
                <h3>Total Surveys</h3>
                <div class="value" id="statTotalSurveys">-</div>
              </div>
              <div class="stat-card">
                <h3>Total Pledges</h3>
                <div class="value" id="statTotalPledges">-</div>
              </div>
              <div class="stat-card">
                <h3>Pledge Rate</h3>
                <div class="value" id="statPledgeRate">-</div>
              </div>
              <div class="stat-card">
                <h3>Total Photos</h3>
                <div class="value" id="statTotalPhotos">-</div>
              </div>
            </div>

            <div class="card">
              <h2>Survey Responses</h2>
              <div class="filter-row">
                <div class="form-group">
                  <label for="dataTeamFilter">Team</label>
                  <select id="dataTeamFilter" onchange="loadEventsForTeam(); loadSurveyResponses();">
                    <option value="">All Teams</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="dataSurveyTypeFilter">Survey Type</label>
                  <select id="dataSurveyTypeFilter" onchange="loadSurveyResponses()">
                    <option value="">All Types</option>
                    <option value="marijuana">Marijuana</option>
                    <option value="alcohol">Alcohol</option>
                    <option value="distracted">Distracted Driving</option>
                    <option value="impaired">Impaired Driving</option>
                    <option value="combo">Combo</option>
                  </select>
                </div>
              </div>

              <!-- Multi-select Events Section -->
              <div class="card" style="background: #252525; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <h3 style="color: #fff; margin: 0;">Select Events for Report</h3>
                  <div>
                    <button class="btn btn-secondary btn-sm" onclick="selectAllEvents()" style="margin-right: 8px;">Select All</button>
                    <button class="btn btn-secondary btn-sm" onclick="deselectAllEvents()">Clear All</button>
                  </div>
                </div>
                <div id="eventsCheckboxList" style="max-height: 200px; overflow-y: auto; background: #1a1a1a; border-radius: 8px; padding: 12px;">
                  <p class="text-muted">Loading events...</p>
                </div>
                <div style="margin-top: 12px; display: flex; align-items: center; gap: 16px;">
                  <span id="selectedEventsCount" style="color: #888;">0 events selected</span>
                  <button class="btn btn-primary btn-sm" onclick="exportPieChartReport()">Export Pie Chart Report</button>
                </div>
              </div>

              <div id="responsesLoading" class="loading">Loading responses...</div>
              <table id="responsesTable" style="display: none;">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Team</th>
                    <th>Event</th>
                    <th>Survey Type</th>
                    <th>Age Range</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody id="responsesBody"></tbody>
              </table>
              <div id="responsesEmpty" class="empty-state" style="display: none;">No survey responses found.</div>
            </div>

            <div class="card">
              <h2>Surveys by Type</h2>
              <div id="surveysByType"></div>
            </div>
          </div>

          <!-- Settings Tab -->
          <div class="tab-content" id="settingsTab">
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Admin Users</h2>
                <button class="btn btn-primary btn-sm" onclick="openAdminUserModal()">Add Admin User</button>
              </div>
              <p style="color: #888; margin-bottom: 20px;">Manage who can access this admin portal. Each admin has their own username and password.</p>
              <div id="adminUsersLoading" class="loading">Loading admin users...</div>
              <table id="adminUsersTable" style="display: none;">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Display Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="adminUsersBody"></tbody>
              </table>
              <div id="adminUsersEmpty" class="empty-state" style="display: none;">
                No admin users found. Create your first admin account!
                <p style="margin-top: 8px; font-size: 13px;">Currently using legacy password (1234)</p>
              </div>
            </div>

            <div class="card">
              <h2>Change Your Password</h2>
              <form id="changePasswordForm" style="max-width: 400px;">
                <div class="form-group">
                  <label for="currentPassword">Current Password</label>
                  <input type="password" id="currentPassword" placeholder="Enter current password" required>
                </div>
                <div class="form-group">
                  <label for="newPassword">New Password</label>
                  <input type="password" id="newPassword" placeholder="Enter new password (min 4 chars)" minlength="4" required>
                </div>
                <div class="form-group">
                  <label for="confirmPassword">Confirm New Password</label>
                  <input type="password" id="confirmPassword" placeholder="Confirm new password" required>
                </div>
                <button type="submit" class="btn btn-primary">Change Password</button>
                <p class="error-message" id="changePasswordError" style="display: none;"></p>
                <p class="success-message" id="changePasswordSuccess" style="display: none; color: #28a745; margin-top: 12px;"></p>
              </form>
            </div>
          </div>
        </main>
      </div>

      <!-- Team Modal -->
      <div class="modal" id="teamModal">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="teamModalTitle">Add Team</h2>
            <button class="modal-close" onclick="closeTeamModal()">&times;</button>
          </div>
          <form id="teamForm">
            <input type="hidden" id="teamId">
            <div class="form-group">
              <label for="teamName">Team Name</label>
              <input type="text" id="teamName" placeholder="e.g., Team Alpha" required>
            </div>
            <div class="form-group">
              <label for="teamCode">Team Code (2-10 characters)</label>
              <input type="text" id="teamCode" placeholder="e.g., ALPHA" maxlength="10" required>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="closeTeamModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Team</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Event Modal -->
      <div class="modal" id="eventModal">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="eventModalTitle">Add Event</h2>
            <button class="modal-close" onclick="closeEventModal()">&times;</button>
          </div>
          <form id="eventForm">
            <input type="hidden" id="eventId">
            <div class="form-group">
              <label for="eventTeam">Team</label>
              <select id="eventTeam" required>
                <option value="">Select a team</option>
              </select>
            </div>
            <div class="form-group">
              <label for="eventVenueName">Venue Name</label>
              <input type="text" id="eventVenueName" placeholder="e.g., Central High School" required>
            </div>
            <div class="form-group">
              <label for="eventVenueCity">City</label>
              <input type="text" id="eventVenueCity" placeholder="e.g., Austin" required>
            </div>
            <div class="form-group">
              <label for="eventVenueState">State</label>
              <input type="text" id="eventVenueState" placeholder="e.g., TX" required>
            </div>
            <div class="form-group">
              <label for="eventDate">Event Date</label>
              <input type="datetime-local" id="eventDate" required>
            </div>
            <div class="form-group">
              <label for="eventEndAt">Event End Time (photos auto-deleted)</label>
              <input type="datetime-local" id="eventEndAt">
              <div style="color: #888; font-size: 12px; margin-top: 4px;">
                When this time passes, every photo and every participant email address
                for this event is deleted automatically. Survey answers are kept.
                Leave blank to purge manually instead.
              </div>
            </div>
            <div class="form-group">
              <label>Survey Types</label>
              <div class="checkbox-group">
                <label class="checkbox-item">
                  <input type="checkbox" name="surveyTypes" value="marijuana">
                  Marijuana
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="surveyTypes" value="alcohol">
                  Alcohol
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="surveyTypes" value="distracted">
                  Distracted
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="surveyTypes" value="impaired">
                  Impaired
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="surveyTypes" value="combo">
                  Combo
                </label>
              </div>
            </div>
            <div class="form-group">
              <label for="eventOverlay">Photo Overlay</label>
              <select id="eventOverlay" required>
                <option value="">Select overlay</option>
                <!-- Options will be populated from database -->
              </select>
            </div>
            <div class="form-group">
              <label class="checkbox-item" style="margin-top: 8px;">
                <input type="checkbox" id="eventPicturePledge">
                Enable Picture Pledge
              </label>
              <p style="font-size: 12px; color: #888; margin-top: 8px;">When enabled, users can take photos with overlays and receive them via email.</p>
            </div>
            <div class="form-group" id="eventStatusGroup" style="display: none;">
              <label for="eventStatus">Status</label>
              <select id="eventStatus">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="closeEventModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Event</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Overlay Modal -->
      <div class="modal" id="overlayModal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Add Overlay</h2>
            <button class="modal-close" onclick="closeOverlayModal()">&times;</button>
          </div>
          <form id="overlayForm">
            <div class="form-group">
              <label for="overlayName">Overlay Name</label>
              <input type="text" id="overlayName" placeholder="e.g., Prom 2026" required>
            </div>
            <div class="form-group">
              <label for="overlayFile">Overlay Image</label>
              <input type="file" id="overlayFile" accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif" required style="padding: 8px;">
              <p style="font-size: 12px; color: #888; margin-top: 8px;">
                Accepted formats: PNG, JPG, GIF, WebP. HEIC (iPhone) is not supported — export as PNG or JPG.<br>
                A <strong>JPG</strong> is used as a polaroid-style frame — the pledge photo is placed
                inside the window in your artwork. A <strong>see-through PNG</strong> is laid on top of
                the photo instead. After uploading a JPG you can check and nudge the window.
              </p>
            </div>
            <div id="overlayPreview" style="display: none; margin-bottom: 20px;">
              <label>Preview</label>
              <img id="overlayPreviewImg" src="" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 1px solid #333; margin-top: 8px;">
            </div>
            <div id="overlayUploadProgress" style="display: none; margin-bottom: 20px;">
              <div style="background: #252525; border-radius: 8px; overflow: hidden;">
                <div id="overlayProgressBar" style="background: #4a9eff; height: 8px; width: 0%; transition: width 0.3s;"></div>
              </div>
              <p style="font-size: 12px; color: #888; margin-top: 8px; text-align: center;">Uploading...</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="closeOverlayModal()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="overlaySubmitBtn">Upload Overlay</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Frame Window Modal -->
      <div class="modal" id="frameModal">
        <div class="modal-content" style="max-width: 900px;">
          <div class="modal-header">
            <h2>Preview / Adjust Overlay</h2>
            <button class="modal-close" onclick="closeFrameModal()">&times;</button>
          </div>
          <p style="font-size: 13px; color: #888; margin-bottom: 16px;">
            A JPG can't be see-through, so it is used as a <strong>frame</strong>: the pledge photo is
            placed inside the window below, like a polaroid. Transparent PNGs are laid on top of the
            photo instead. Drag the sliders until the sample photo lines up with your artwork.
          </p>
          <div style="display: flex; gap: 24px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 260px;">
              <img id="framePreviewImg" src="" alt="Preview"
                   style="width: 100%; border-radius: 8px; border: 1px solid #333; background: #111;">
            </div>
            <div style="flex: 1; min-width: 260px;">
              <div class="form-group">
                <label for="frameMode">How to apply</label>
                <select id="frameMode" onchange="onFrameModeChange()">
                  <option value="auto">Automatic (recommended)</option>
                  <option value="frame">Frame — photo goes inside the window</option>
                  <option value="overlay">Overlay — stretched on top of the photo</option>
                </select>
              </div>
              <div id="frameWindowControls">
                <div class="form-group">
                  <label>Left edge — <span id="frameXVal"></span>%</label>
                  <input type="range" id="frameX" min="0" max="90" step="0.5" oninput="onFrameSliderChange()" style="width: 100%;">
                </div>
                <div class="form-group">
                  <label>Top edge — <span id="frameYVal"></span>%</label>
                  <input type="range" id="frameY" min="0" max="90" step="0.5" oninput="onFrameSliderChange()" style="width: 100%;">
                </div>
                <div class="form-group">
                  <label>Width — <span id="frameWVal"></span>%</label>
                  <input type="range" id="frameW" min="5" max="100" step="0.5" oninput="onFrameSliderChange()" style="width: 100%;">
                </div>
                <div class="form-group">
                  <label>Height — <span id="frameHVal"></span>%</label>
                  <input type="range" id="frameH" min="5" max="100" step="0.5" oninput="onFrameSliderChange()" style="width: 100%;">
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="redetectFrameWindow()">
                  Find the window for me
                </button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeFrameModal()">Close</button>
            <button type="button" class="btn btn-primary" id="frameSaveBtn" onclick="saveFrameWindow()">Save</button>
          </div>
        </div>
      </div>

      <!-- Survey Modal -->
      <div class="modal" id="surveyModal">
        <div class="modal-content" style="max-width: 700px;">
          <div class="modal-header">
            <h2 id="surveyModalTitle">Add Survey</h2>
            <button class="modal-close" onclick="closeSurveyModal()">&times;</button>
          </div>
          <form id="surveyForm">
            <input type="hidden" id="surveySlugOriginal">
            <div class="form-group">
              <label for="surveyName">Survey Name</label>
              <input type="text" id="surveyName" placeholder="e.g., Marijuana Awareness" required>
            </div>
            <div class="form-group">
              <label for="surveySlug">Slug (URL-friendly identifier)</label>
              <input type="text" id="surveySlug" placeholder="e.g., marijuana" pattern="^[a-z0-9-]+$" title="Lowercase letters, numbers, and hyphens only" required>
              <p style="font-size: 12px; color: #888; margin-top: 4px;">Lowercase letters, numbers, and hyphens only</p>
            </div>
            <div class="form-group">
              <label for="surveyDescription">Description (optional)</label>
              <textarea id="surveyDescription" placeholder="Brief description of this survey" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label class="checkbox-item">
                <input type="checkbox" id="surveyIsActive" checked>
                Active
              </label>
            </div>

            <div style="border-top: 1px solid #333; margin: 20px 0; padding-top: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="color: #fff; margin: 0;">Questions</h3>
                <button type="button" class="btn btn-secondary btn-sm" onclick="addSurveyQuestion()">Add Question</button>
              </div>
              <div id="surveyQuestionsContainer"></div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="closeSurveyModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Survey</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Survey Results Modal -->
      <div class="modal" id="surveyResultsModal">
        <div class="modal-content" style="max-width: 800px;">
          <div class="modal-header">
            <h2 id="surveyResultsTitle">Survey Results</h2>
            <button class="modal-close" onclick="closeSurveyResultsModal()">&times;</button>
          </div>
          <div id="surveyResultsContent">
            <div class="loading">Loading results...</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeSurveyResultsModal()">Close</button>
          </div>
        </div>
      </div>

      <!-- Admin User Modal -->
      <div class="modal" id="adminUserModal">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="adminUserModalTitle">Add Admin User</h2>
            <button class="modal-close" onclick="closeAdminUserModal()">&times;</button>
          </div>
          <form id="adminUserForm">
            <input type="hidden" id="adminUserId">
            <div class="form-group">
              <label for="adminUsername">Username</label>
              <input type="text" id="adminUsername" placeholder="e.g., johndoe" pattern="^[a-z0-9_]+$" title="Lowercase letters, numbers, and underscores only" required>
              <p style="font-size: 12px; color: #888; margin-top: 4px;">Lowercase letters, numbers, and underscores only</p>
            </div>
            <div class="form-group">
              <label for="adminDisplayName">Display Name</label>
              <input type="text" id="adminDisplayName" placeholder="e.g., John Doe">
            </div>
            <div class="form-group" id="adminPasswordGroup">
              <label for="adminPassword">Password</label>
              <input type="password" id="adminPassword" placeholder="Min 4 characters" minlength="4">
              <p style="font-size: 12px; color: #888; margin-top: 4px;" id="adminPasswordHint">Required for new users</p>
            </div>
            <div class="form-group">
              <label for="adminRole">Role</label>
              <select id="adminRole">
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
            <div class="form-group" id="adminActiveGroup" style="display: none;">
              <label class="checkbox-item">
                <input type="checkbox" id="adminIsActive" checked>
                Active
              </label>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="closeAdminUserModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>

      <script>
        // State
        let teams = [];
        let events = [];
        let overlays = [];
        let surveyTypes = [];
        let analytics = null;

        // API Base URL
        const API_BASE = '/api';

        // Check if logged in on page load
        document.addEventListener('DOMContentLoaded', () => {
          if (localStorage.getItem('adminLoggedIn') === 'true') {
            showDashboard();
          }

          // Tab switching
          document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
              document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
              document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
              tab.classList.add('active');
              document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');

              // Load data for the tab
              if (tab.dataset.tab === 'teams') loadTeams();
              if (tab.dataset.tab === 'events') loadEvents();
              if (tab.dataset.tab === 'overlays') loadOverlays();
              if (tab.dataset.tab === 'surveys') loadSurveyTypes();
              if (tab.dataset.tab === 'data') {
                loadEventsForTeam();
                loadAnalytics();
                loadSurveyResponses();
              }
              if (tab.dataset.tab === 'settings') loadAdminUsers();
            });
          });

          // Form submissions
          document.getElementById('loginForm').addEventListener('submit', handleLogin);
          document.getElementById('teamForm').addEventListener('submit', handleTeamSubmit);
          document.getElementById('eventForm').addEventListener('submit', handleEventSubmit);
          document.getElementById('overlayForm').addEventListener('submit', handleOverlaySubmit);
          document.getElementById('surveyForm').addEventListener('submit', handleSurveySubmit);
          document.getElementById('adminUserForm').addEventListener('submit', handleAdminUserSubmit);
          document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);

          // Overlay file preview
          document.getElementById('overlayFile').addEventListener('change', handleOverlayFileChange);

          // Check if admin users exist to show legacy hint
          checkAdminUsersExist();
        });

        // Current logged in user
        let currentUser = null;

        async function checkAdminUsersExist() {
          try {
            const res = await fetch(API_BASE + '/admin-users');
            const data = await res.json();
            if (data.data && data.data.length === 0) {
              document.getElementById('legacyHint').style.display = 'block';
            }
          } catch (err) {
            // Ignore error
          }
        }

        // Login handler
        async function handleLogin(e) {
          e.preventDefault();
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const errorEl = document.getElementById('loginError');

          errorEl.style.display = 'none';

          if (!username || !password) {
            errorEl.textContent = 'Please enter username and password';
            errorEl.style.display = 'block';
            return;
          }

          try {
            const res = await fetch(API_BASE + '/admin-users/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            console.log('Login response:', data);

            if (data.data && data.data.success) {
              currentUser = data.data.user;
              localStorage.setItem('adminLoggedIn', 'true');
              localStorage.setItem('adminUser', JSON.stringify(currentUser));

              if (data.data.isLegacy) {
                alert('You are using the legacy password. Please go to Settings to create an admin account with your own password.');
              }

              showDashboard();
            } else {
              errorEl.textContent = data.error?.message || 'Invalid credentials';
              errorEl.style.display = 'block';
            }
          } catch (err) {
            console.error('Login error:', err);
            errorEl.textContent = 'Connection error: ' + err.message;
            errorEl.style.display = 'block';
          }
        }

        function logout() {
          localStorage.removeItem('adminLoggedIn');
          localStorage.removeItem('adminUser');
          currentUser = null;
          document.getElementById('loginScreen').style.display = 'flex';
          document.getElementById('dashboard').style.display = 'none';
          document.getElementById('username').value = '';
          document.getElementById('password').value = '';
        }

        function showDashboard() {
          // Restore current user from localStorage
          const savedUser = localStorage.getItem('adminUser');
          if (savedUser) {
            currentUser = JSON.parse(savedUser);
          }

          document.getElementById('loginScreen').style.display = 'none';
          document.getElementById('dashboard').style.display = 'block';
          loadTeams();
          // Pre-load overlays for the event dropdown
          loadOverlaysForDropdown();
        }

        // Load overlays silently for dropdown (doesn't update UI table)
        async function loadOverlaysForDropdown() {
          try {
            const res = await fetch(API_BASE + '/overlays');
            const data = await res.json();
            overlays = data.data || [];
            updateOverlayDropdown();
          } catch (err) {
            console.error('Error loading overlays for dropdown:', err);
          }
        }

        // Teams
        async function loadTeams() {
          document.getElementById('teamsLoading').style.display = 'block';
          document.getElementById('teamsTable').style.display = 'none';
          document.getElementById('teamsEmpty').style.display = 'none';

          try {
            const res = await fetch(API_BASE + '/teams');
            const data = await res.json();
            teams = data.data || [];

            if (teams.length === 0) {
              document.getElementById('teamsLoading').style.display = 'none';
              document.getElementById('teamsEmpty').style.display = 'block';
              return;
            }

            const tbody = document.getElementById('teamsBody');
            tbody.innerHTML = teams.map(team => \`
              <tr>
                <td>\${escapeHtml(team.name)}</td>
                <td><span class="badge badge-info">\${escapeHtml(team.code)}</span></td>
                <td>\${new Date(team.createdAt).toLocaleDateString()}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="editTeam('\${team.id}')">Edit</button>
                </td>
              </tr>
            \`).join('');

            document.getElementById('teamsLoading').style.display = 'none';
            document.getElementById('teamsTable').style.display = 'table';

            // Update team dropdowns
            updateTeamDropdowns();
          } catch (err) {
            document.getElementById('teamsLoading').textContent = 'Error loading teams';
          }
        }

        function updateTeamDropdowns() {
          const dropdowns = ['eventTeamFilter', 'dataTeamFilter', 'eventTeam'];
          dropdowns.forEach(id => {
            const select = document.getElementById(id);
            const currentValue = select.value;
            const firstOption = select.options[0];
            select.innerHTML = '';
            select.appendChild(firstOption);
            teams.forEach(team => {
              const option = document.createElement('option');
              option.value = team.id;
              option.textContent = team.name + ' (' + team.code + ')';
              select.appendChild(option);
            });
            select.value = currentValue;
          });
        }

        function openTeamModal(teamId = null) {
          document.getElementById('teamId').value = '';
          document.getElementById('teamName').value = '';
          document.getElementById('teamCode').value = '';
          document.getElementById('teamModalTitle').textContent = 'Add Team';

          if (teamId) {
            const team = teams.find(t => t.id === teamId);
            if (team) {
              document.getElementById('teamId').value = team.id;
              document.getElementById('teamName').value = team.name;
              document.getElementById('teamCode').value = team.code;
              document.getElementById('teamModalTitle').textContent = 'Edit Team';
            }
          }

          document.getElementById('teamModal').classList.add('active');
        }

        function closeTeamModal() {
          document.getElementById('teamModal').classList.remove('active');
        }

        function editTeam(teamId) {
          openTeamModal(teamId);
        }

        async function handleTeamSubmit(e) {
          e.preventDefault();
          const id = document.getElementById('teamId').value;
          const name = document.getElementById('teamName').value;
          const code = document.getElementById('teamCode').value;

          try {
            const url = id ? API_BASE + '/teams/' + id : API_BASE + '/teams';
            const method = id ? 'PUT' : 'POST';

            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, code })
            });

            const data = await res.json();

            if (data.error) {
              alert(data.error.message);
              return;
            }

            closeTeamModal();
            loadTeams();
          } catch (err) {
            alert('Error saving team');
          }
        }

        // Events
        async function loadEvents() {
          document.getElementById('eventsLoading').style.display = 'block';
          document.getElementById('eventsTable').style.display = 'none';
          document.getElementById('eventsEmpty').style.display = 'none';

          const teamId = document.getElementById('eventTeamFilter').value;
          const status = document.getElementById('eventStatusFilter').value;

          let url = API_BASE + '/events?';
          if (teamId) url += 'teamId=' + teamId + '&';
          if (status) url += 'status=' + status + '&';

          try {
            const res = await fetch(url);
            const data = await res.json();
            events = data.data || [];

            // Update event dropdown in data tab
            const eventSelect = document.getElementById('dataEventFilter');
            const currentValue = eventSelect.value;
            eventSelect.innerHTML = '<option value="">All Events</option>';
            events.forEach(event => {
              const option = document.createElement('option');
              option.value = event.id;
              option.textContent = event.venueName + ' - ' + new Date(event.eventDate).toLocaleDateString();
              eventSelect.appendChild(option);
            });
            eventSelect.value = currentValue;

            if (events.length === 0) {
              document.getElementById('eventsLoading').style.display = 'none';
              document.getElementById('eventsEmpty').style.display = 'block';
              return;
            }

            const tbody = document.getElementById('eventsBody');
            tbody.innerHTML = events.map(event => \`
              <tr>
                <td>
                  \${escapeHtml(event.venueName)}
                  \${event.picturePledgeEnabled ? '<span class="badge badge-info" style="margin-left: 8px;">Picture Pledge</span>' : ''}
                </td>
                <td>\${escapeHtml(event.venueCity)}, \${escapeHtml(event.venueState)}</td>
                <td>\${new Date(event.eventDate).toLocaleDateString()}</td>
                <td>\${describePurge(event)}</td>
                <td>\${event.team ? escapeHtml(event.team.name) : '-'}</td>
                <td>
                  <span class="badge \${event.status === 'active' ? 'badge-success' : 'badge-warning'}">
                    \${event.status}
                  </span>
                </td>
                <td>\${event._count?.surveyResponses || 0}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="editEvent('\${event.id}')">Edit</button>
                  \${event.status === 'active' ? \`<button class="btn btn-warning btn-sm" onclick="completeEvent('\${event.id}')">Complete</button>\` : ''}
                  <button class="btn btn-danger btn-sm" onclick="purgeEventData('\${event.id}', '\${escapeHtml(event.venueName).replace(/'/g, "\\\\'")}')">Purge Now</button>
                </td>
              </tr>
            \`).join('');

            document.getElementById('eventsLoading').style.display = 'none';
            document.getElementById('eventsTable').style.display = 'table';
          } catch (err) {
            document.getElementById('eventsLoading').textContent = 'Error loading events';
          }
        }

        // datetime-local inputs want local wall-clock time, not UTC.
        function toDateTimeLocal(isoString) {
          const date = new Date(isoString);
          const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          return local.toISOString().slice(0, 16);
        }

        function openEventModal(eventId = null) {
          document.getElementById('eventId').value = '';
          document.getElementById('eventTeam').value = '';
          document.getElementById('eventVenueName').value = '';
          document.getElementById('eventVenueCity').value = '';
          document.getElementById('eventVenueState').value = '';
          document.getElementById('eventDate').value = '';
          document.getElementById('eventEndAt').value = '';
          document.getElementById('eventOverlay').value = '';
          document.getElementById('eventStatus').value = 'active';
          document.getElementById('eventStatusGroup').style.display = 'none';
          document.getElementById('eventPicturePledge').checked = false;
          document.querySelectorAll('input[name="surveyTypes"]').forEach(cb => cb.checked = false);
          document.getElementById('eventModalTitle').textContent = 'Add Event';

          if (eventId) {
            const event = events.find(e => e.id === eventId);
            if (event) {
              document.getElementById('eventId').value = event.id;
              document.getElementById('eventTeam').value = event.teamId;
              document.getElementById('eventVenueName').value = event.venueName;
              document.getElementById('eventVenueCity').value = event.venueCity;
              document.getElementById('eventVenueState').value = event.venueState;

              // Format date for datetime-local input
              const date = new Date(event.eventDate);
              const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
              document.getElementById('eventDate').value = localDate.toISOString().slice(0, 16);

              document.getElementById('eventEndAt').value = event.eventEndAt
                ? toDateTimeLocal(event.eventEndAt)
                : '';

              document.getElementById('eventOverlay').value = event.overlayType;
              document.getElementById('eventStatus').value = event.status;
              document.getElementById('eventStatusGroup').style.display = 'block';
              document.getElementById('eventPicturePledge').checked = event.picturePledgeEnabled || false;

              // Set survey types checkboxes
              const surveyTypes = event.surveyTypes || [];
              document.querySelectorAll('input[name="surveyTypes"]').forEach(cb => {
                cb.checked = surveyTypes.includes(cb.value);
              });

              document.getElementById('eventModalTitle').textContent = 'Edit Event';
            }
          }

          document.getElementById('eventModal').classList.add('active');
        }

        function closeEventModal() {
          document.getElementById('eventModal').classList.remove('active');
        }

        function editEvent(eventId) {
          openEventModal(eventId);
        }

        async function completeEvent(eventId) {
          if (!confirm('Are you sure you want to mark this event as completed?')) return;

          try {
            const res = await fetch(API_BASE + '/events/' + eventId + '/complete', {
              method: 'PUT'
            });

            const data = await res.json();

            if (data.error) {
              alert(data.error.message);
              return;
            }

            loadEvents();
          } catch (err) {
            alert('Error completing event');
          }
        }

        // What the Photo Deletion column shows for one event.
        function describePurge(event) {
          if (event.photosPurgedAt) {
            return '<span class="badge badge-success">Deleted ' +
              new Date(event.photosPurgedAt).toLocaleString() + '</span>';
          }
          if (!event.eventEndAt) {
            return '<span class="badge badge-warning">Manual only</span>';
          }
          const endsAt = new Date(event.eventEndAt);
          const label = endsAt.toLocaleString();
          return endsAt <= new Date()
            ? '<span class="badge badge-warning">Due ' + label + '</span>'
            : '<span class="badge badge-info">Auto ' + label + '</span>';
        }

        // Post-event privacy purge, run on demand. Deletes the photos and the
        // participant email addresses for one event, and keeps the survey
        // answers. This is the same work the automatic end-of-event purge does.
        async function purgeEventData(eventId, venueName) {
          if (!confirm(
            'Delete participant data for "' + venueName + '" now?\\n\\n' +
            'This DELETES:\\n' +
            '  - all participant photos for this event\\n' +
            '  - all participant email addresses for this event\\n' +
            '  - any pledge emails still waiting to send\\n\\n' +
            'This KEEPS:\\n' +
            '  - all survey answers and age ranges for reporting\\n\\n' +
            'This cannot be undone.'
          )) return;

          try {
            const res = await fetch(API_BASE + '/events/' + eventId + '/purge', {
              method: 'POST'
            });
            const data = await res.json();

            if (data.error) {
              alert('Could not purge: ' + data.error.message);
              return;
            }

            alert(
              'Purge complete for "' + venueName + '".\\n\\n' +
              'Deleted ' + (data.data.purgedPhotoCount || 0) + ' photo(s)\\n' +
              'Deleted ' + (data.data.purgedPledgeCount || 0) + ' email address(es)\\n' +
              'Deleted ' + (data.data.purgedQueuedEmailCount || 0) + ' unsent email(s)\\n\\n' +
              'Kept ' + (data.data.survivingSurveyResponseCount || 0) + ' survey response(s).'
            );

            loadEvents();
          } catch (err) {
            alert('Error purging participant data');
          }
        }

        async function handleEventSubmit(e) {
          e.preventDefault();
          const id = document.getElementById('eventId').value;
          const teamId = document.getElementById('eventTeam').value;
          const venueName = document.getElementById('eventVenueName').value;
          const venueCity = document.getElementById('eventVenueCity').value;
          const venueState = document.getElementById('eventVenueState').value;
          const eventDate = document.getElementById('eventDate').value;
          const eventEndAtRaw = document.getElementById('eventEndAt').value;
          const overlayType = document.getElementById('eventOverlay').value;
          const status = document.getElementById('eventStatus').value;
          const picturePledgeEnabled = document.getElementById('eventPicturePledge').checked;

          const surveyTypes = [];
          document.querySelectorAll('input[name="surveyTypes"]:checked').forEach(cb => {
            surveyTypes.push(cb.value);
          });

          if (surveyTypes.length === 0) {
            alert('Please select at least one survey type');
            return;
          }

          try {
            const url = id ? API_BASE + '/events/' + id : API_BASE + '/events';
            const method = id ? 'PUT' : 'POST';

            const body = {
              venueName,
              venueCity,
              venueState,
              eventDate,
              // Sent as a full ISO timestamp so the server stores the same
              // instant the staff member picked, not a UTC-shifted one.
              eventEndAt: eventEndAtRaw ? new Date(eventEndAtRaw).toISOString() : null,
              overlayType,
              surveyTypes,
              picturePledgeEnabled
            };

            if (!id) {
              body.teamId = teamId;
            }

            if (id) {
              body.status = status;
            }

            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });

            const data = await res.json();

            if (data.error) {
              alert(data.error.message);
              return;
            }

            closeEventModal();
            loadEvents();
          } catch (err) {
            alert('Error saving event');
          }
        }

        // Overlays
        async function loadOverlays() {
          document.getElementById('overlaysLoading').style.display = 'block';
          document.getElementById('overlaysTable').style.display = 'none';
          document.getElementById('overlaysEmpty').style.display = 'none';

          try {
            const res = await fetch(API_BASE + '/overlays');
            const data = await res.json();
            overlays = data.data || [];

            if (overlays.length === 0) {
              document.getElementById('overlaysLoading').style.display = 'none';
              document.getElementById('overlaysEmpty').style.display = 'block';
              updateOverlayDropdown();
              return;
            }

            const tbody = document.getElementById('overlaysBody');
            tbody.innerHTML = overlays.map(overlay => \`
              <tr>
                <td>
                  <img src="\${escapeHtml(overlay.url)}" alt="\${escapeHtml(overlay.name)}"
                       style="max-width: 80px; max-height: 60px; border-radius: 4px; border: 1px solid #333;">
                </td>
                <td>\${escapeHtml(overlay.name)}</td>
                <td>\${escapeHtml(overlay.filename)}</td>
                <td>
                  <span class="badge \${isFrameOverlay(overlay) ? 'badge-info' : 'badge-warning'}">
                    \${isFrameOverlay(overlay) ? 'Frame (photo inside)' : 'Overlay (on top)'}
                  </span>
                </td>
                <td>\${formatFileSize(overlay.sizeBytes)}</td>
                <td>
                  <span class="badge \${overlay.isActive ? 'badge-success' : 'badge-warning'}">
                    \${overlay.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>\${new Date(overlay.createdAt).toLocaleDateString()}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="openFrameModal('\${overlay.id}')">Preview / Adjust</button>
                  <button class="btn btn-secondary btn-sm" onclick="toggleOverlayStatus('\${overlay.id}', \${!overlay.isActive})">
                    \${overlay.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="deleteOverlay('\${overlay.id}')">Delete</button>
                </td>
              </tr>
            \`).join('');

            document.getElementById('overlaysLoading').style.display = 'none';
            document.getElementById('overlaysTable').style.display = 'table';

            // Update overlay dropdown in event modal
            updateOverlayDropdown();
          } catch (err) {
            document.getElementById('overlaysLoading').textContent = 'Error loading overlays';
            console.error('Error loading overlays:', err);
          }
        }

        function updateOverlayDropdown() {
          const select = document.getElementById('eventOverlay');
          const currentValue = select.value;
          select.innerHTML = '<option value="">Select overlay</option>';

          // Add active overlays from database
          const activeOverlays = overlays.filter(o => o.isActive);
          activeOverlays.forEach(overlay => {
            const option = document.createElement('option');
            option.value = overlay.id;
            option.textContent = overlay.name;
            select.appendChild(option);
          });

          // If no overlays exist, show a hint
          if (activeOverlays.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No overlays available - add one in Overlays tab";
            option.disabled = true;
            select.appendChild(option);
          }

          select.value = currentValue;
        }

        // A JPG can't be transparent, so it is applied as a polaroid frame.
        function isFrameOverlay(overlay) {
          if (overlay.mode === 'frame') return true;
          if (overlay.mode === 'overlay') return false;
          return !/png|webp|gif/i.test(overlay.contentType || '');
        }

        // Frame window editor
        let frameOverlay = null;
        let framePreviewTimer = null;

        function openFrameModal(id) {
          frameOverlay = overlays.find(o => o.id === id);
          if (!frameOverlay) return;

          document.getElementById('frameMode').value = frameOverlay.mode || 'auto';
          document.getElementById('frameX').value = (frameOverlay.windowX ?? 0.07) * 100;
          document.getElementById('frameY').value = (frameOverlay.windowY ?? 0.06) * 100;
          document.getElementById('frameW').value = (frameOverlay.windowW ?? 0.86) * 100;
          document.getElementById('frameH').value = (frameOverlay.windowH ?? 0.72) * 100;

          updateFrameLabels();
          onFrameModeChange();
          refreshFramePreview();
          document.getElementById('frameModal').classList.add('active');
        }

        function closeFrameModal() {
          document.getElementById('frameModal').classList.remove('active');
          frameOverlay = null;
        }

        function frameWindowValues() {
          return {
            windowX: parseFloat(document.getElementById('frameX').value) / 100,
            windowY: parseFloat(document.getElementById('frameY').value) / 100,
            windowW: parseFloat(document.getElementById('frameW').value) / 100,
            windowH: parseFloat(document.getElementById('frameH').value) / 100,
          };
        }

        function updateFrameLabels() {
          document.getElementById('frameXVal').textContent = document.getElementById('frameX').value;
          document.getElementById('frameYVal').textContent = document.getElementById('frameY').value;
          document.getElementById('frameWVal').textContent = document.getElementById('frameW').value;
          document.getElementById('frameHVal').textContent = document.getElementById('frameH').value;
        }

        function onFrameModeChange() {
          const mode = document.getElementById('frameMode').value;
          const usesWindow = mode !== 'overlay' &&
            (mode === 'frame' || (frameOverlay && isFrameOverlay(frameOverlay)));
          document.getElementById('frameWindowControls').style.display = usesWindow ? 'block' : 'none';
        }

        // Sliders write to the server first, then reload the preview, so what
        // you see is exactly what the pledge photo will look like.
        function onFrameSliderChange() {
          updateFrameLabels();
          clearTimeout(framePreviewTimer);
          framePreviewTimer = setTimeout(async () => {
            await saveFrameWindow({ silent: true });
            refreshFramePreview();
          }, 350);
        }

        function refreshFramePreview() {
          if (!frameOverlay) return;
          document.getElementById('framePreviewImg').src =
            API_BASE + '/overlays/' + frameOverlay.id + '/preview?t=' + Date.now();
        }

        async function saveFrameWindow(options) {
          if (!frameOverlay) return;
          const silent = options && options.silent;
          const btn = document.getElementById('frameSaveBtn');
          if (!silent) btn.disabled = true;

          try {
            const res = await fetch(API_BASE + '/overlays/' + frameOverlay.id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mode: document.getElementById('frameMode').value,
                ...frameWindowValues(),
              }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);

            frameOverlay = data.data;
            const idx = overlays.findIndex(o => o.id === frameOverlay.id);
            if (idx !== -1) overlays[idx] = frameOverlay;

            if (!silent) {
              refreshFramePreview();
              loadOverlays();
            }
          } catch (err) {
            if (!silent) alert('Error saving overlay: ' + err.message);
            console.error('Error saving overlay:', err);
          } finally {
            if (!silent) btn.disabled = false;
          }
        }

        async function redetectFrameWindow() {
          if (!frameOverlay) return;
          try {
            const res = await fetch(API_BASE + '/overlays/' + frameOverlay.id + '/redetect-window', {
              method: 'POST',
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);

            frameOverlay = data.data;
            document.getElementById('frameX').value = (frameOverlay.windowX ?? 0.07) * 100;
            document.getElementById('frameY').value = (frameOverlay.windowY ?? 0.06) * 100;
            document.getElementById('frameW').value = (frameOverlay.windowW ?? 0.86) * 100;
            document.getElementById('frameH').value = (frameOverlay.windowH ?? 0.72) * 100;
            updateFrameLabels();
            refreshFramePreview();
          } catch (err) {
            alert('Could not find the window: ' + err.message);
          }
        }

        function openOverlayModal() {
          document.getElementById('overlayName').value = '';
          document.getElementById('overlayFile').value = '';
          document.getElementById('overlayPreview').style.display = 'none';
          document.getElementById('overlayUploadProgress').style.display = 'none';
          document.getElementById('overlaySubmitBtn').disabled = false;
          document.getElementById('overlayModal').classList.add('active');
        }

        function closeOverlayModal() {
          document.getElementById('overlayModal').classList.remove('active');
        }

        function handleOverlayFileChange(e) {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
              document.getElementById('overlayPreviewImg').src = e.target.result;
              document.getElementById('overlayPreview').style.display = 'block';
            };
            reader.readAsDataURL(file);
          } else {
            document.getElementById('overlayPreview').style.display = 'none';
          }
        }

        async function handleOverlaySubmit(e) {
          e.preventDefault();
          const name = document.getElementById('overlayName').value;
          const fileInput = document.getElementById('overlayFile');
          const file = fileInput.files[0];

          if (!file) {
            alert('Please select a file');
            return;
          }

          // Show progress
          document.getElementById('overlayUploadProgress').style.display = 'block';
          document.getElementById('overlaySubmitBtn').disabled = true;
          document.getElementById('overlayProgressBar').style.width = '30%';

          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', name);

            document.getElementById('overlayProgressBar').style.width = '60%';

            const res = await fetch(API_BASE + '/overlays', {
              method: 'POST',
              body: formData
            });

            document.getElementById('overlayProgressBar').style.width = '90%';

            // Read the body as text first: an upload rejected by a proxy comes
            // back as HTML, and calling .json() on that hides the real reason.
            const raw = await res.text();
            let data = null;
            try { data = JSON.parse(raw); } catch (parseErr) { data = null; }

            if (!res.ok || !data || data.error || !data.data) {
              const reason = (data && data.error && data.error.message)
                || (raw ? raw.slice(0, 300) : '')
                || ('The server returned ' + res.status + ' with no details.');
              console.error('Overlay upload failed:', res.status, raw);
              alert('Upload failed (' + res.status + '): ' + reason);
              document.getElementById('overlayUploadProgress').style.display = 'none';
              document.getElementById('overlaySubmitBtn').disabled = false;
              return;
            }

            document.getElementById('overlayProgressBar').style.width = '100%';

            const uploaded = data.data;

            setTimeout(async () => {
              closeOverlayModal();
              await loadOverlays();
              // A JPG becomes a polaroid frame — open the editor straight away
              // so the window can be checked against a sample photo.
              if (uploaded && isFrameOverlay(uploaded)) {
                openFrameModal(uploaded.id);
              }
            }, 300);
          } catch (err) {
            console.error('Overlay upload error:', err);
            alert('Could not upload the overlay: ' + (err && err.message ? err.message : err)
              + '\\n\\nIf this says "Failed to fetch", the connection dropped mid-upload — check your network and try again.');
            document.getElementById('overlayUploadProgress').style.display = 'none';
            document.getElementById('overlaySubmitBtn').disabled = false;
          }
        }

        async function toggleOverlayStatus(id, isActive) {
          try {
            const res = await fetch(API_BASE + '/overlays/' + id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive })
            });

            const data = await res.json();

            if (data.error) {
              alert(data.error.message);
              return;
            }

            loadOverlays();
          } catch (err) {
            alert('Error updating overlay');
          }
        }

        async function deleteOverlay(id) {
          if (!confirm('Are you sure you want to delete this overlay? This cannot be undone.')) return;

          try {
            const res = await fetch(API_BASE + '/overlays/' + id, {
              method: 'DELETE'
            });

            const data = await res.json();

            if (data.error) {
              alert(data.error.message);
              return;
            }

            loadOverlays();
          } catch (err) {
            alert('Error deleting overlay');
          }
        }

        function formatFileSize(bytes) {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        // Analytics & Data
        let allEventsForData = [];

        async function loadAnalytics() {
          const teamId = document.getElementById('dataTeamFilter').value;
          const selectedEvents = getSelectedEventIds();

          let url = API_BASE + '/admin/analytics?';
          if (teamId) url += 'teamId=' + teamId + '&';
          if (selectedEvents.length === 1) url += 'eventId=' + selectedEvents[0] + '&';

          try {
            const res = await fetch(url);
            const data = await res.json();
            analytics = data.data;

            document.getElementById('statTotalSurveys').textContent = analytics.totalSurveys;
            document.getElementById('statTotalPledges').textContent = analytics.totalPledges;
            document.getElementById('statPledgeRate').textContent = analytics.pledgeRate + '%';
            document.getElementById('statTotalPhotos').textContent = analytics.totalPhotos;

            // Surveys by type
            const typeDiv = document.getElementById('surveysByType');
            if (analytics.surveysByType.length > 0) {
              typeDiv.innerHTML = \`
                <table>
                  <thead>
                    <tr>
                      <th>Survey Type</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${analytics.surveysByType.map(t => \`
                      <tr>
                        <td>\${escapeHtml(t.surveyTypeSlug)}</td>
                        <td>\${t.count}</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              \`;
            } else {
              typeDiv.innerHTML = '<p class="text-muted">No data available</p>';
            }
          } catch (err) {
            console.error('Error loading analytics:', err);
          }
        }

        async function loadEventsForTeam() {
          const teamId = document.getElementById('dataTeamFilter').value;

          let url = API_BASE + '/events?';
          if (teamId) url += 'teamId=' + teamId + '&';

          try {
            const res = await fetch(url);
            const data = await res.json();
            allEventsForData = data.data || [];
            renderEventsCheckboxList();
          } catch (err) {
            console.error('Error loading events:', err);
          }
        }

        function renderEventsCheckboxList() {
          const container = document.getElementById('eventsCheckboxList');

          if (allEventsForData.length === 0) {
            container.innerHTML = '<p class="text-muted">No events found.</p>';
            updateSelectedEventsCount();
            return;
          }

          container.innerHTML = allEventsForData.map(event => \`
            <label class="checkbox-item" style="display: flex; padding: 8px; border-bottom: 1px solid #333; cursor: pointer;">
              <input type="checkbox" class="event-checkbox" value="\${event.id}" onchange="updateSelectedEventsCount()" style="margin-right: 12px;">
              <div style="flex: 1;">
                <div style="color: #fff;">\${escapeHtml(event.venueName)}</div>
                <div style="color: #888; font-size: 12px;">\${escapeHtml(event.venueCity)}, \${escapeHtml(event.venueState)} - \${new Date(event.eventDate).toLocaleDateString()}</div>
              </div>
              <span class="badge \${event.status === 'active' ? 'badge-success' : 'badge-warning'}" style="align-self: center;">
                \${event.status}
              </span>
            </label>
          \`).join('');

          updateSelectedEventsCount();
        }

        function getSelectedEventIds() {
          const checkboxes = document.querySelectorAll('.event-checkbox:checked');
          return Array.from(checkboxes).map(cb => cb.value);
        }

        function updateSelectedEventsCount() {
          const count = getSelectedEventIds().length;
          document.getElementById('selectedEventsCount').textContent = count + ' event' + (count !== 1 ? 's' : '') + ' selected';
        }

        function selectAllEvents() {
          document.querySelectorAll('.event-checkbox').forEach(cb => cb.checked = true);
          updateSelectedEventsCount();
        }

        function deselectAllEvents() {
          document.querySelectorAll('.event-checkbox').forEach(cb => cb.checked = false);
          updateSelectedEventsCount();
        }

        async function loadSurveyResponses() {
          document.getElementById('responsesLoading').style.display = 'block';
          document.getElementById('responsesTable').style.display = 'none';
          document.getElementById('responsesEmpty').style.display = 'none';

          const teamId = document.getElementById('dataTeamFilter').value;
          const surveyType = document.getElementById('dataSurveyTypeFilter').value;

          let url = API_BASE + '/surveys/responses?';
          if (teamId) url += 'teamId=' + teamId + '&';
          if (surveyType) url += 'surveyTypeSlug=' + surveyType + '&';

          try {
            const res = await fetch(url);
            const data = await res.json();
            const responses = data.data || [];

            if (responses.length === 0) {
              document.getElementById('responsesLoading').style.display = 'none';
              document.getElementById('responsesEmpty').style.display = 'block';
              return;
            }

            const tbody = document.getElementById('responsesBody');
            tbody.innerHTML = responses.slice(0, 100).map(r => \`
              <tr>
                <td>\${new Date(r.completedAt).toLocaleString()}</td>
                <td>\${r.team ? escapeHtml(r.team.name) : '-'}</td>
                <td>\${r.event ? escapeHtml(r.event.venueName) : '-'}</td>
                <td><span class="badge badge-info">\${escapeHtml(r.surveyTypeSlug)}</span></td>
                <td>\${r.ageRange || '-'}</td>
                <td>\${r.durationSeconds ? r.durationSeconds + 's' : '-'}</td>
              </tr>
            \`).join('');

            document.getElementById('responsesLoading').style.display = 'none';
            document.getElementById('responsesTable').style.display = 'table';

            // Also refresh analytics
            loadAnalytics();
          } catch (err) {
            document.getElementById('responsesLoading').textContent = 'Error loading responses';
          }
        }

        async function exportPieChartReport() {
          const teamId = document.getElementById('dataTeamFilter').value;
          const selectedEventIds = getSelectedEventIds();
          const surveyTypeSlug = document.getElementById('dataSurveyTypeFilter').value;

          // Validate selection
          if (selectedEventIds.length === 0) {
            alert('Please select at least one event to generate the report.');
            return;
          }

          // Get selected event names for the report
          const selectedEventNames = selectedEventIds.map(id => {
            const event = allEventsForData.find(e => e.id === id);
            return event ? event.venueName + ' (' + new Date(event.eventDate).toLocaleDateString() + ')' : id;
          });

          // Show loading state
          const btn = event.target;
          const originalText = btn.textContent;
          btn.textContent = 'Generating...';
          btn.disabled = true;

          try {
            // Load all survey types with results
            const surveyTypesRes = await fetch(API_BASE + '/surveys/types?includeInactive=true');
            const surveyTypesData = await surveyTypesRes.json();
            const allSurveyTypes = surveyTypesData.data || [];

            // Filter to selected survey type if specified
            const typesToExport = surveyTypeSlug
              ? allSurveyTypes.filter(st => st.slug === surveyTypeSlug)
              : allSurveyTypes.filter(st => st.isActive);

            // Load results for each survey type, aggregating across all selected events
            const resultsPromises = typesToExport.map(async (st) => {
              // Fetch results for each selected event and aggregate
              const eventResultsPromises = selectedEventIds.map(async (eventId) => {
                let url = API_BASE + '/surveys/results/' + st.slug + '?';
                if (teamId) url += 'teamId=' + teamId + '&';
                url += 'eventId=' + eventId + '&';

                const res = await fetch(url);
                const data = await res.json();
                return data.data;
              });

              const eventResults = await Promise.all(eventResultsPromises);

              // Aggregate results from all events
              return aggregateSurveyResults(st, eventResults);
            });

            const allResults = await Promise.all(resultsPromises);

            // Generate HTML report with event names
            const reportHtml = generatePieChartReportHtml(allResults, analytics, selectedEventNames);

            // Open in new window for printing/saving
            const printWindow = window.open('', '_blank');
            printWindow.document.write(reportHtml);
            printWindow.document.close();

          } catch (err) {
            alert('Error generating report');
            console.error(err);
          } finally {
            btn.textContent = originalText;
            btn.disabled = false;
          }
        }

        // Aggregate survey results from multiple events
        function aggregateSurveyResults(surveyType, eventResults) {
          // Filter out null results
          const validResults = eventResults.filter(r => r && r.questionResults);

          if (validResults.length === 0) {
            return {
              surveyType: {
                id: surveyType.id,
                slug: surveyType.slug,
                name: surveyType.name,
                description: surveyType.description
              },
              totalResponses: 0,
              questionResults: []
            };
          }

          // Use the first result as a template
          const template = validResults[0];
          const totalResponses = validResults.reduce((sum, r) => sum + r.totalResponses, 0);

          // Aggregate question results
          const aggregatedQuestions = template.questionResults.map((templateQuestion, qIndex) => {
            // Sum up counts for each option across all events
            const aggregatedOptions = templateQuestion.options.map((templateOption, oIndex) => {
              const totalCount = validResults.reduce((sum, result) => {
                const question = result.questionResults[qIndex];
                if (question && question.options[oIndex]) {
                  return sum + question.options[oIndex].count;
                }
                return sum;
              }, 0);

              return {
                label: templateOption.label,
                count: totalCount,
                percentage: 0 // Will calculate after
              };
            });

            // Percentages are out of the number of PEOPLE who answered this
            // question, not the number of taps. On a multiple-choice question
            // one person can pick three options, so summing the option counts
            // would push the total past 100%.
            const respondentTotal = validResults.reduce((sum, result) => {
              const question = result.questionResults[qIndex];
              return sum + (question ? question.totalResponses || 0 : 0);
            }, 0);

            aggregatedOptions.forEach(opt => {
              opt.percentage = respondentTotal > 0 ? Math.round((opt.count / respondentTotal) * 100) : 0;
            });

            return {
              questionId: templateQuestion.questionId,
              orderIndex: templateQuestion.orderIndex,
              questionText: templateQuestion.questionText,
              totalResponses: respondentTotal,
              options: aggregatedOptions
            };
          });

          return {
            surveyType: {
              id: surveyType.id,
              slug: surveyType.slug,
              name: surveyType.name,
              description: surveyType.description
            },
            totalResponses: totalResponses,
            questionResults: aggregatedQuestions
          };
        }

        function generatePieChartReportHtml(allResults, analytics, selectedEventNames) {
          const colors = ['#4a9eff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#17a2b8', '#6c757d'];
          const date = new Date().toLocaleDateString();

          // Build events list HTML
          const eventsListHtml = selectedEventNames && selectedEventNames.length > 0
            ? '<div style="margin-top: 16px; padding: 16px; background: #f0f7ff; border-radius: 8px;"><strong>Events Included:</strong><ul style="margin: 8px 0 0 20px; color: #666;">' +
              selectedEventNames.map(name => '<li>' + escapeHtml(name) + '</li>').join('') +
              '</ul></div>'
            : '';

          let surveySections = '';

          allResults.forEach(result => {
            if (!result || result.totalResponses === 0) return;

            let questionsHtml = '';
            result.questionResults.forEach((qr, qIndex) => {
              const total = qr.options.reduce((sum, opt) => sum + opt.count, 0);
              if (total === 0) return;

              // Generate conic gradient for pie chart
              let gradientParts = [];
              let currentDeg = 0;
              qr.options.forEach((opt, i) => {
                const color = colors[i % colors.length];
                const degrees = (opt.count / total) * 360;
                gradientParts.push(color + ' ' + currentDeg + 'deg ' + (currentDeg + degrees) + 'deg');
                currentDeg += degrees;
              });
              const gradient = 'conic-gradient(' + gradientParts.join(', ') + ')';

              // Generate legend items
              let legendHtml = qr.options.map((opt, i) => {
                const color = colors[i % colors.length];
                return '<div style="display: flex; align-items: center; margin-bottom: 8px;">' +
                  '<div style="width: 16px; height: 16px; background: ' + color + '; border-radius: 3px; margin-right: 10px;"></div>' +
                  '<span style="flex: 1;">' + escapeHtml(opt.label) + '</span>' +
                  '<span style="font-weight: 600; margin-left: 10px;">' + opt.count + ' (' + opt.percentage + '%)</span>' +
                '</div>';
              }).join('');

              questionsHtml += \`
                <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 20px; page-break-inside: avoid;">
                  <h3 style="color: #333; margin: 0 0 20px 0; font-size: 16px;">Q\${qr.orderIndex}: \${escapeHtml(qr.questionText)}</h3>
                  <div style="display: flex; gap: 40px; align-items: flex-start;">
                    <div style="width: 150px; height: 150px; background: \${gradient}; border-radius: 50%; flex-shrink: 0;"></div>
                    <div style="flex: 1;">
                      \${legendHtml}
                      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd; color: #666; font-size: 13px;">
                        Total responses: <strong>\${total}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              \`;
            });

            if (questionsHtml) {
              surveySections += \`
                <div style="margin-bottom: 40px; page-break-before: auto;">
                  <h2 style="color: #333; border-bottom: 3px solid #4a9eff; padding-bottom: 10px; margin-bottom: 24px;">
                    \${escapeHtml(result.surveyType.name)}
                    <span style="font-weight: normal; font-size: 16px; color: #666; margin-left: 12px;">(\${result.totalResponses} responses)</span>
                  </h2>
                  \${questionsHtml}
                </div>
              \`;
            }
          });

          if (!surveySections) {
            surveySections = '<p style="text-align: center; color: #666; padding: 40px;">No survey data available for the selected filters.</p>';
          }

          return \`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Survey Results Report - \${date}</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #fff;
                  color: #333;
                  line-height: 1.5;
                }
                .container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
                .header {
                  text-align: center;
                  margin-bottom: 40px;
                  padding-bottom: 24px;
                  border-bottom: 2px solid #eee;
                }
                .header h1 { color: #333; font-size: 28px; margin-bottom: 8px; }
                .header p { color: #666; font-size: 14px; }
                .summary {
                  display: flex;
                  justify-content: center;
                  gap: 24px;
                  margin-bottom: 40px;
                  flex-wrap: wrap;
                }
                .summary-card {
                  background: #f0f7ff;
                  border-radius: 12px;
                  padding: 20px 32px;
                  text-align: center;
                }
                .summary-card h3 { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
                .summary-card .value { color: #4a9eff; font-size: 32px; font-weight: 700; margin-top: 8px; }
                .print-btn {
                  display: block;
                  margin: 0 auto 40px;
                  padding: 12px 32px;
                  background: #4a9eff;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  font-size: 16px;
                  cursor: pointer;
                }
                .print-btn:hover { background: #3a8eef; }
                @media print {
                  .print-btn { display: none; }
                  body { background: white; }
                  .container { padding: 20px; }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Survey Results Report</h1>
                  <p>Arrive Alive Tour - Generated on \${date}</p>
                  \${eventsListHtml}
                </div>

                <div class="summary">
                  <div class="summary-card">
                    <h3>Total Surveys</h3>
                    <div class="value">\${analytics?.totalSurveys || 0}</div>
                  </div>
                  <div class="summary-card">
                    <h3>Total Pledges</h3>
                    <div class="value">\${analytics?.totalPledges || 0}</div>
                  </div>
                  <div class="summary-card">
                    <h3>Pledge Rate</h3>
                    <div class="value">\${analytics?.pledgeRate || 0}%</div>
                  </div>
                </div>

                <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>

                \${surveySections}

                <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 2px solid #eee; color: #999; font-size: 12px;">
                  Generated by Arrive Alive Tour Admin Portal
                </div>
              </div>
            </body>
            </html>
          \`;
        }

        // Survey Types Management
        async function loadSurveyTypes() {
          document.getElementById('surveyTypesLoading').style.display = 'block';
          document.getElementById('surveyTypesTable').style.display = 'none';
          document.getElementById('surveyTypesEmpty').style.display = 'none';

          const includeInactive = document.getElementById('showInactiveSurveys').checked;
          const url = API_BASE + '/surveys/types' + (includeInactive ? '?includeInactive=true' : '');

          try {
            const res = await fetch(url);
            const data = await res.json();
            surveyTypes = data.data || [];

            if (surveyTypes.length === 0) {
              document.getElementById('surveyTypesLoading').style.display = 'none';
              document.getElementById('surveyTypesEmpty').style.display = 'block';
              return;
            }

            const tbody = document.getElementById('surveyTypesBody');
            tbody.innerHTML = surveyTypes.map(st => \`
              <tr>
                <td>\${escapeHtml(st.name)}</td>
                <td><span class="badge badge-info">\${escapeHtml(st.slug)}</span></td>
                <td>\${st.questions ? st.questions.length : 0}</td>
                <td>
                  <span class="badge \${st.isActive ? 'badge-success' : 'badge-warning'}">
                    \${st.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>\${new Date(st.createdAt).toLocaleDateString()}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="editSurveyType('\${escapeHtml(st.slug)}')">Edit</button>
                  <button class="btn btn-info btn-sm" onclick="viewSurveyResults('\${escapeHtml(st.slug)}')">Results</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteSurveyType('\${escapeHtml(st.slug)}')">Delete</button>
                </td>
              </tr>
            \`).join('');

            document.getElementById('surveyTypesLoading').style.display = 'none';
            document.getElementById('surveyTypesTable').style.display = 'table';
          } catch (err) {
            document.getElementById('surveyTypesLoading').textContent = 'Error loading survey types';
            console.error('Error loading survey types:', err);
          }
        }

        function openSurveyModal(surveySlug = null) {
          document.getElementById('surveySlugOriginal').value = '';
          document.getElementById('surveyName').value = '';
          document.getElementById('surveySlug').value = '';
          document.getElementById('surveySlug').disabled = false;
          document.getElementById('surveyDescription').value = '';
          document.getElementById('surveyIsActive').checked = true;
          document.getElementById('surveyQuestionsContainer').innerHTML = '';
          document.getElementById('surveyModalTitle').textContent = 'Add Survey';

          if (surveySlug) {
            const survey = surveyTypes.find(s => s.slug === surveySlug);
            if (survey) {
              document.getElementById('surveySlugOriginal').value = survey.slug;
              document.getElementById('surveyName').value = survey.name;
              document.getElementById('surveySlug').value = survey.slug;
              document.getElementById('surveySlug').disabled = true; // Cannot change slug on edit
              document.getElementById('surveyDescription').value = survey.description || '';
              document.getElementById('surveyIsActive').checked = survey.isActive;
              document.getElementById('surveyModalTitle').textContent = 'Edit Survey';

              // Populate questions
              if (survey.questions && survey.questions.length > 0) {
                survey.questions.forEach((q, index) => {
                  addSurveyQuestion(q);
                });
              }
            }
          }

          document.getElementById('surveyModal').classList.add('active');
        }

        function closeSurveyModal() {
          document.getElementById('surveyModal').classList.remove('active');
        }

        function editSurveyType(slug) {
          openSurveyModal(slug);
        }

        let questionCounter = 0;
        function addSurveyQuestion(existingQuestion = null) {
          questionCounter++;
          const container = document.getElementById('surveyQuestionsContainer');
          const questionIndex = container.children.length + 1;

          const questionDiv = document.createElement('div');
          questionDiv.className = 'survey-question-item';
          questionDiv.style.cssText = 'background: #252525; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 12px;';
          questionDiv.dataset.questionId = questionCounter;

          const questionText = existingQuestion ? existingQuestion.questionText : '';
          const options = existingQuestion ? existingQuestion.options : ['', ''];
          const isRequired = existingQuestion ? existingQuestion.isRequired : true;
          const answerType = existingQuestion && existingQuestion.answerType === 'multi_select'
            ? 'multi_select'
            : 'single_choice';

          questionDiv.innerHTML = \`
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="color: #888; font-weight: 500;">Question \${questionIndex}</span>
              <button type="button" class="btn btn-danger btn-sm" onclick="removeSurveyQuestion(this)" style="padding: 4px 8px;">&times;</button>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label>Question Text</label>
              <input type="text" class="question-text" value="\${escapeHtml(questionText)}" placeholder="Enter your question" required>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label>Answer Type</label>
              <select class="question-answer-type">
                <option value="single_choice" \${answerType === 'single_choice' ? 'selected' : ''}>Single choice — pick one answer</option>
                <option value="multi_select" \${answerType === 'multi_select' ? 'selected' : ''}>Multiple choice — pick any number of answers</option>
              </select>
              <small style="color: #888; display: block; margin-top: 4px;">
                Single choice moves to the next question as soon as the guest taps an answer.
                Multiple choice lets them tap several answers and then press Continue.
              </small>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label>Options</label>
              <div class="question-options">
                \${options.map((opt, i) => \`
                  <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <input type="text" class="option-input" value="\${escapeHtml(opt)}" placeholder="Option \${i + 1}" required style="flex: 1;">
                    <button type="button" class="btn btn-danger btn-sm" onclick="removeQuestionOption(this)" style="padding: 4px 8px;">&times;</button>
                  </div>
                \`).join('')}
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="addQuestionOption(this)" style="margin-top: 4px;">Add Option</button>
            </div>
            <div class="form-group">
              <label class="checkbox-item">
                <input type="checkbox" class="question-required" \${isRequired ? 'checked' : ''}>
                Required
              </label>
            </div>
          \`;

          container.appendChild(questionDiv);
          updateQuestionNumbers();
        }

        function removeSurveyQuestion(button) {
          const questionDiv = button.closest('.survey-question-item');
          questionDiv.remove();
          updateQuestionNumbers();
        }

        function updateQuestionNumbers() {
          const questions = document.querySelectorAll('.survey-question-item');
          questions.forEach((q, index) => {
            const label = q.querySelector('span');
            if (label) label.textContent = 'Question ' + (index + 1);
          });
        }

        function addQuestionOption(button) {
          const optionsContainer = button.previousElementSibling;
          const optionCount = optionsContainer.children.length + 1;
          const optionDiv = document.createElement('div');
          optionDiv.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
          optionDiv.innerHTML = \`
            <input type="text" class="option-input" value="" placeholder="Option \${optionCount}" required style="flex: 1;">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeQuestionOption(this)" style="padding: 4px 8px;">&times;</button>
          \`;
          optionsContainer.appendChild(optionDiv);
        }

        function removeQuestionOption(button) {
          const optionDiv = button.parentElement;
          const optionsContainer = optionDiv.parentElement;
          if (optionsContainer.children.length > 2) {
            optionDiv.remove();
          } else {
            alert('A question must have at least 2 options');
          }
        }

        async function handleSurveySubmit(e) {
          e.preventDefault();

          const originalSlug = document.getElementById('surveySlugOriginal').value;
          const name = document.getElementById('surveyName').value;
          const slug = document.getElementById('surveySlug').value;
          const description = document.getElementById('surveyDescription').value || null;
          const isActive = document.getElementById('surveyIsActive').checked;

          // Gather questions
          const questionElements = document.querySelectorAll('.survey-question-item');
          const questions = [];

          for (let i = 0; i < questionElements.length; i++) {
            const qEl = questionElements[i];
            const questionText = qEl.querySelector('.question-text').value;
            const isRequired = qEl.querySelector('.question-required').checked;
            const answerType = qEl.querySelector('.question-answer-type').value;
            const optionInputs = qEl.querySelectorAll('.option-input');
            const options = Array.from(optionInputs).map(inp => inp.value).filter(v => v.trim() !== '');

            if (options.length < 2) {
              alert('Each question must have at least 2 options');
              return;
            }

            questions.push({
              orderIndex: i + 1,
              questionText,
              answerType,
              options,
              isRequired
            });
          }

          if (questions.length === 0) {
            alert('Please add at least one question');
            return;
          }

          try {
            const isEdit = !!originalSlug;
            const url = isEdit ? API_BASE + '/surveys/types/' + originalSlug : API_BASE + '/surveys/types';
            const method = isEdit ? 'PUT' : 'POST';

            const body = isEdit
              ? { name, description, isActive, questions }
              : { slug, name, description, questions };

            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });

            const data = await res.json();

            if (data.error) {
              alert(data.error.message);
              return;
            }

            closeSurveyModal();
            loadSurveyTypes();
          } catch (err) {
            alert('Error saving survey');
            console.error(err);
          }
        }

        async function deleteSurveyType(slug) {
          if (!confirm('Are you sure you want to delete/deactivate this survey type?')) return;

          try {
            const res = await fetch(API_BASE + '/surveys/types/' + slug, {
              method: 'DELETE'
            });

            const data = await res.json();

            if (data.error) {
              alert(data.error.message);
              return;
            }

            if (data.data.deactivated) {
              alert('Survey type deactivated (has ' + data.data.responseCount + ' existing responses)');
            }

            loadSurveyTypes();
          } catch (err) {
            alert('Error deleting survey type');
            console.error(err);
          }
        }

        // Survey Results (Pie Charts)
        async function viewSurveyResults(slug) {
          document.getElementById('surveyResultsModal').classList.add('active');
          document.getElementById('surveyResultsContent').innerHTML = '<div class="loading">Loading results...</div>';

          const survey = surveyTypes.find(s => s.slug === slug);
          document.getElementById('surveyResultsTitle').textContent = survey ? survey.name + ' - Results' : 'Survey Results';

          try {
            const res = await fetch(API_BASE + '/surveys/results/' + slug);
            const data = await res.json();

            if (data.error) {
              document.getElementById('surveyResultsContent').innerHTML = '<p class="text-muted">' + data.error.message + '</p>';
              return;
            }

            const results = data.data;

            if (results.totalResponses === 0) {
              document.getElementById('surveyResultsContent').innerHTML = '<p class="text-muted">No responses yet for this survey.</p>';
              return;
            }

            let html = \`
              <div style="margin-bottom: 20px;">
                <p style="color: #888;">Total Responses: <strong style="color: #fff;">\${results.totalResponses}</strong></p>
              </div>
            \`;

            results.questionResults.forEach((qr, index) => {
              html += \`
                <div style="background: #252525; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                  <h4 style="color: #fff; margin-bottom: 16px;">Q\${qr.orderIndex}: \${escapeHtml(qr.questionText)}</h4>
                  <div style="display: flex; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 0 0 180px;">
                      \${renderPieChart(qr.options)}
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                      \${renderBarChart(qr.options)}
                    </div>
                  </div>
                </div>
              \`;
            });

            document.getElementById('surveyResultsContent').innerHTML = html;
          } catch (err) {
            document.getElementById('surveyResultsContent').innerHTML = '<p class="text-muted">Error loading results</p>';
            console.error(err);
          }
        }

        function closeSurveyResultsModal() {
          document.getElementById('surveyResultsModal').classList.remove('active');
        }

        // CSS Pie Chart using conic-gradient
        function renderPieChart(options) {
          const colors = ['#4a9eff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#17a2b8', '#6c757d'];
          const total = options.reduce((sum, opt) => sum + opt.count, 0);

          if (total === 0) {
            return '<div style="width: 150px; height: 150px; background: #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #666;">No data</div>';
          }

          let gradientParts = [];
          let currentDeg = 0;

          options.forEach((opt, i) => {
            const color = colors[i % colors.length];
            const degrees = (opt.count / total) * 360;
            gradientParts.push(\`\${color} \${currentDeg}deg \${currentDeg + degrees}deg\`);
            currentDeg += degrees;
          });

          const gradient = \`conic-gradient(\${gradientParts.join(', ')})\`;

          return \`<div style="width: 150px; height: 150px; background: \${gradient}; border-radius: 50%;"></div>\`;
        }

        // Bar Chart using CSS
        function renderBarChart(options) {
          const colors = ['#4a9eff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#17a2b8', '#6c757d'];
          const maxCount = Math.max(...options.map(o => o.count), 1);

          let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';

          options.forEach((opt, i) => {
            const color = colors[i % colors.length];
            const widthPercent = (opt.count / maxCount) * 100;

            html += \`
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 12px; height: 12px; background: \${color}; border-radius: 2px; flex-shrink: 0;"></div>
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: #ccc; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="\${escapeHtml(opt.label)}">\${escapeHtml(opt.label)}</span>
                    <span style="color: #888; font-size: 12px; flex-shrink: 0; margin-left: 8px;">\${opt.count} (\${opt.percentage}%)</span>
                  </div>
                  <div style="background: #333; border-radius: 4px; height: 8px; overflow: hidden;">
                    <div style="background: \${color}; height: 100%; width: \${widthPercent}%; transition: width 0.3s;"></div>
                  </div>
                </div>
              </div>
            \`;
          });

          html += '</div>';
          return html;
        }

        // Admin Users Management
        let adminUsers = [];

        async function loadAdminUsers() {
          document.getElementById('adminUsersLoading').style.display = 'block';
          document.getElementById('adminUsersTable').style.display = 'none';
          document.getElementById('adminUsersEmpty').style.display = 'none';

          try {
            const res = await fetch(API_BASE + '/admin-users');
            const data = await res.json();
            adminUsers = data.data || [];

            if (adminUsers.length === 0) {
              document.getElementById('adminUsersLoading').style.display = 'none';
              document.getElementById('adminUsersEmpty').style.display = 'block';
              return;
            }

            const tbody = document.getElementById('adminUsersBody');
            tbody.innerHTML = adminUsers.map(user => \`
              <tr>
                <td>\${escapeHtml(user.username)}</td>
                <td>\${escapeHtml(user.displayName || '-')}</td>
                <td><span class="badge badge-info">\${escapeHtml(user.role)}</span></td>
                <td>
                  <span class="badge \${user.isActive ? 'badge-success' : 'badge-warning'}">
                    \${user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>\${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="editAdminUser('\${user.id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteAdminUser('\${user.id}')" \${adminUsers.length === 1 ? 'disabled title="Cannot delete the only admin"' : ''}>Delete</button>
                </td>
              </tr>
            \`).join('');

            document.getElementById('adminUsersLoading').style.display = 'none';
            document.getElementById('adminUsersTable').style.display = 'table';
          } catch (err) {
            document.getElementById('adminUsersLoading').textContent = 'Error loading admin users';
            console.error('Error loading admin users:', err);
          }
        }

        function openAdminUserModal(userId = null) {
          document.getElementById('adminUserId').value = '';
          document.getElementById('adminUsername').value = '';
          document.getElementById('adminUsername').disabled = false;
          document.getElementById('adminDisplayName').value = '';
          document.getElementById('adminPassword').value = '';
          document.getElementById('adminPassword').required = true;
          document.getElementById('adminPasswordHint').textContent = 'Required for new users';
          document.getElementById('adminRole').value = 'admin';
          document.getElementById('adminIsActive').checked = true;
          document.getElementById('adminActiveGroup').style.display = 'none';
          document.getElementById('adminUserModalTitle').textContent = 'Add Admin User';

          if (userId) {
            const user = adminUsers.find(u => u.id === userId);
            if (user) {
              document.getElementById('adminUserId').value = user.id;
              document.getElementById('adminUsername').value = user.username;
              document.getElementById('adminUsername').disabled = true; // Cannot change username
              document.getElementById('adminDisplayName').value = user.displayName || '';
              document.getElementById('adminPassword').required = false;
              document.getElementById('adminPasswordHint').textContent = 'Leave blank to keep current password';
              document.getElementById('adminRole').value = user.role;
              document.getElementById('adminIsActive').checked = user.isActive;
              document.getElementById('adminActiveGroup').style.display = 'block';
              document.getElementById('adminUserModalTitle').textContent = 'Edit Admin User';
            }
          }

          document.getElementById('adminUserModal').classList.add('active');
        }

        function closeAdminUserModal() {
          document.getElementById('adminUserModal').classList.remove('active');
        }

        function editAdminUser(userId) {
          openAdminUserModal(userId);
        }

        async function handleAdminUserSubmit(e) {
          e.preventDefault();

          const id = document.getElementById('adminUserId').value;
          const username = document.getElementById('adminUsername').value;
          const displayName = document.getElementById('adminDisplayName').value || null;
          const password = document.getElementById('adminPassword').value;
          const role = document.getElementById('adminRole').value;
          const isActive = document.getElementById('adminIsActive').checked;

          try {
            const isEdit = !!id;
            const url = isEdit ? API_BASE + '/admin-users/' + id : API_BASE + '/admin-users';
            const method = isEdit ? 'PUT' : 'POST';

            const body = isEdit
              ? { displayName, role, isActive, ...(password && { password }) }
              : { username, displayName, password, role };

            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });

            const data = await res.json();

            if (data.error) {
              alert(data.error.message);
              return;
            }

            closeAdminUserModal();
            loadAdminUsers();

            if (!isEdit) {
              alert('Admin user created! They can now log in with username: ' + username);
            }
          } catch (err) {
            alert('Error saving admin user');
            console.error(err);
          }
        }

        async function deleteAdminUser(userId) {
          if (!confirm('Are you sure you want to delete this admin user?')) return;

          try {
            const res = await fetch(API_BASE + '/admin-users/' + userId, {
              method: 'DELETE'
            });

            const data = await res.json();

            if (data.error) {
              alert(data.error.message);
              return;
            }

            loadAdminUsers();
          } catch (err) {
            alert('Error deleting admin user');
            console.error(err);
          }
        }

        async function handleChangePassword(e) {
          e.preventDefault();

          const currentPassword = document.getElementById('currentPassword').value;
          const newPassword = document.getElementById('newPassword').value;
          const confirmPassword = document.getElementById('confirmPassword').value;
          const errorEl = document.getElementById('changePasswordError');
          const successEl = document.getElementById('changePasswordSuccess');

          errorEl.style.display = 'none';
          successEl.style.display = 'none';

          if (newPassword !== confirmPassword) {
            errorEl.textContent = 'New passwords do not match';
            errorEl.style.display = 'block';
            return;
          }

          if (!currentUser || currentUser.id === 'legacy') {
            errorEl.textContent = 'Please create an admin account first to change passwords';
            errorEl.style.display = 'block';
            return;
          }

          try {
            const res = await fetch(API_BASE + '/admin-users/change-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: currentUser.username,
                currentPassword,
                newPassword
              })
            });

            const data = await res.json();

            if (data.error) {
              errorEl.textContent = data.error.message;
              errorEl.style.display = 'block';
              return;
            }

            successEl.textContent = 'Password changed successfully!';
            successEl.style.display = 'block';
            document.getElementById('changePasswordForm').reset();
          } catch (err) {
            errorEl.textContent = 'Error changing password';
            errorEl.style.display = 'block';
            console.error(err);
          }
        }

        // Utility
        function escapeHtml(text) {
          if (!text) return '';
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }
      </script>
    </body>
    </html>
  `);
});

export { adminPortalRouter };
