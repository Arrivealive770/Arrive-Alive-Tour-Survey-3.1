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
  // The whole admin site — markup and script — is this one response, and the
  // desktop server is updated in place underneath a browser that is usually
  // left open for days. Without this, the browser keeps serving the page it
  // cached before the update, so a fix that is genuinely live on the server
  // still looks broken to whoever is standing in front of it.
  c.header("Cache-Control", "no-store, must-revalidate");
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

        /* Column headings you can click to sort. */
        th.sortable {
          cursor: pointer;
          user-select: none;
        }

        th.sortable:hover {
          color: #fff;
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
          <div class="tab" data-tab="email">Email</div>
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
                    <th>App Admin Access</th>
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
                    <th>Overlay</th>
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
                <div id="statScopeSurveys" style="color: #888; font-size: 12px;">across all events</div>
              </div>
              <div class="stat-card">
                <h3>Total Photos</h3>
                <div class="value" id="statTotalPhotos">-</div>
                <div id="statScopePhotos" style="color: #888; font-size: 12px;">across all events</div>
              </div>
            </div>

            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <h2 style="margin: 0;">Survey Responses</h2>
                <button class="btn btn-danger btn-sm" id="deleteSelectedResponses" onclick="deleteSelectedResponses()" disabled>Delete Selected</button>
              </div>
              <p class="text-muted" style="margin: 8px 0 16px; font-size: 12px;">
                Tick a survey and use Delete to remove that one answer — a test run or a
                double tap. The event, its photos and every other survey are kept.
              </p>
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
                <div style="display: flex; gap: 12px; align-items: flex-end; margin-bottom: 12px;">
                  <div class="form-group" style="flex: 1; margin: 0;">
                    <label for="eventSearchFilter">Search</label>
                    <input type="text" id="eventSearchFilter" placeholder="Venue, city or state..." oninput="renderEventsCheckboxList()">
                  </div>
                  <div class="form-group" style="margin: 0;">
                    <label for="eventSortFilter">Sort by</label>
                    <select id="eventSortFilter" onchange="renderEventsCheckboxList()">
                      <option value="date-desc">Date (newest first)</option>
                      <option value="date-asc">Date (oldest first)</option>
                      <option value="name-asc">Name (A–Z)</option>
                      <option value="name-desc">Name (Z–A)</option>
                      <option value="state-asc">State (A–Z)</option>
                      <option value="state-desc">State (Z–A)</option>
                    </select>
                  </div>
                </div>
                <div id="eventsCheckboxList" style="max-height: 200px; overflow-y: auto; background: #1a1a1a; border-radius: 8px; padding: 12px;">
                  <p class="text-muted">Loading events...</p>
                </div>
                <div style="margin-top: 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                  <span id="selectedEventsCount" style="color: #888;">0 events selected</span>
                  <button class="btn btn-primary btn-sm" onclick="exportPieChartReport()">Export Pie Chart Report</button>
                  <button class="btn btn-secondary btn-sm" onclick="downloadSpreadsheet('summary', this)">Spreadsheet: Totals</button>
                  <button class="btn btn-secondary btn-sm" onclick="downloadSpreadsheet('responses', this)">Spreadsheet: Every Response</button>
                  <button class="btn btn-secondary btn-sm" onclick="downloadSpreadsheet('legacy', this)">Spreadsheet: Old Survey Format</button>
                </div>
                <p class="text-muted" style="margin: 8px 0 0; font-size: 12px;">
                  Spreadsheets open in Excel, Google Sheets or Numbers. "Totals" holds the same
                  numbers as the pie charts; "Every Response" is one row per survey taken.
                  "Old Survey Format" matches the columns of the survey results kept before this
                  app (Date, Survey_Type, Grouping, 1A…9E), so new rows paste under the old ones.
                </p>
              </div>

              <div id="responsesLoading" class="loading">Loading responses...</div>
              <table id="responsesTable" style="display: none;">
                <thead>
                  <!-- Click a heading to sort; click again to reverse it. -->
                  <tr>
                    <th style="width: 32px;"><input type="checkbox" id="responsesSelectAll" onchange="toggleAllResponses(this.checked)" title="Select every survey shown"></th>
                    <th class="sortable" onclick="sortResponsesBy('date')">Date <span id="responsesSortDate"></span></th>
                    <th class="sortable" onclick="sortResponsesBy('team')">Team <span id="responsesSortTeam"></span></th>
                    <th class="sortable" onclick="sortResponsesBy('name')">Event <span id="responsesSortName"></span></th>
                    <th class="sortable" onclick="sortResponsesBy('state')">State <span id="responsesSortState"></span></th>
                    <th>Survey Type</th>
                    <th>Age Range</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="responsesBody"></tbody>
              </table>
              <p id="responsesTruncated" style="display: none; color: #888; font-size: 12px; margin-top: 12px;"></p>
              <div id="responsesEmpty" class="empty-state" style="display: none;">No survey responses found.</div>
            </div>

            <div class="card">
              <h2>Surveys by Type</h2>
              <div id="surveysByType"></div>
            </div>
          </div>

          <!-- Email Tab -->
          <div class="tab-content" id="emailTab">
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Pledge Email Delivery</h2>
                <button class="btn btn-secondary btn-sm" onclick="loadEmailStatus()">Refresh</button>
              </div>
              <div id="emailStatusLoading" class="loading">Checking...</div>
              <div id="emailStatusBox" style="display: none;"></div>
            </div>

            <div class="card">
              <h2>Send a Test Email</h2>
              <p style="color: #888; margin-bottom: 20px;">
                Sends a plain test message to any address so you can confirm delivery
                without running a pledge through a tablet. If it fails, the exact
                reason from the email provider is shown below.
              </p>
              <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; max-width: 640px;">
                <input type="email" id="testEmailAddress" placeholder="you@example.com" style="flex: 1; min-width: 240px;">
                <button class="btn btn-primary" id="testEmailBtn" onclick="sendTestEmail()">Send Test</button>
              </div>
              <div id="testEmailResult" style="display: none; margin-top: 16px;"></div>
            </div>

            <div class="card">
              <h2>Check the Connection to Resend</h2>
              <p style="color: #888; margin-bottom: 20px;">
                Use this when the key is definitely correct but sending still fails.
                It contacts Resend without using your key at all, purely to see who
                answers. If something on this network is intercepting the connection,
                this is what proves it — and no key is involved, so the result is safe
                to share with anyone.
              </p>
              <button class="btn btn-secondary" id="connCheckBtn" onclick="checkResendConnection()">Check Connection</button>
              <div id="connCheckResult" style="display: none; margin-top: 16px;"></div>
            </div>

            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Emails Waiting or Stuck</h2>
                <button class="btn btn-warning btn-sm" onclick="retryFailedEmails()">Retry All Failed</button>
              </div>
              <div id="emailQueueLoading" class="loading">Loading...</div>
              <table id="emailQueueTable" style="display: none;">
                <thead>
                  <tr>
                    <th>Queued</th>
                    <th>To</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Tries</th>
                    <th>Last Problem</th>
                  </tr>
                </thead>
                <tbody id="emailQueueBody"></tbody>
              </table>
              <div id="emailQueueEmpty" class="empty-state" style="display: none;">
                Nothing waiting. Every pledge email has either been delivered or had no address given.
              </div>
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
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="teamIsAdmin" style="width: 18px; height: 18px;">
                <span>Admin team &mdash; devices on this team can open Admin in the app</span>
              </label>
              <p style="color: #888; font-size: 13px; margin-top: 6px;">
                Leave unticked for field teams. Their tablets and phones can run
                surveys and pledge photos, but cannot see events, devices,
                results or the data wipe.
              </p>
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
              <label for="eventTimeZone">Venue Time Zone</label>
              <select id="eventTimeZone" onchange="updateTimeZoneLabel()"></select>
              <div style="color: #888; font-size: 12px; margin-top: 4px;">
                The zone the venue is in. Start and end times below are read in this
                zone, and the tablets at the venue show the same clock time — whatever
                their own clocks are set to.
              </div>
            </div>
            <div class="form-group">
              <label for="eventDate">Event Date</label>
              <input type="datetime-local" id="eventDate" required>
            </div>
            <div class="form-group">
              <label for="eventEndAt">Scheduled End Time</label>
              <input type="datetime-local" id="eventEndAt">
              <div style="color: #888; font-size: 12px; margin-top: 4px;">
                The planned finish, shown on the tablets. It does <strong>not</strong> close
                the event — events run late, so the facilitator ends it with "End Event"
                on the device, or you press "Complete" here. Once the event is ended and
                the tablets have finished uploading, every photo and participant email
                address for it is deleted automatically; survey answers are kept.
                An event nobody ends is closed and purged 6 hours after this time.
              </div>
              <div style="color: #888; font-size: 12px; margin-top: 4px;">
                Times are read in <strong id="eventTimeZoneLabel" style="color: #ccc;"></strong>,
                and the tablets at the venue show exactly what you type here.
              </div>
            </div>
            <div class="form-group">
              <label>Survey Types</label>
              <!-- Filled from the surveys built on the Surveys tab -->
              <div class="checkbox-group" id="eventSurveyTypes">
                <span style="color: #888; font-size: 13px;">Loading your surveys…</span>
              </div>
            </div>
            <div class="form-group">
              <label>Photo Overlay</label>
              <!-- Stock is the default: an event with nothing picked here gets
                   the standard Arrive Alive frame, so creating an event never
                   waits on artwork being uploaded first. Custom reveals the
                   search box and dropdown below. -->
              <div style="display: flex; gap: 20px; margin-bottom: 12px;">
                <label class="checkbox-item">
                  <input type="radio" name="eventOverlaySource" value="stock" checked onchange="onEventOverlaySourceChange()">
                  Stock overlay
                </label>
                <label class="checkbox-item">
                  <input type="radio" name="eventOverlaySource" value="custom" onchange="onEventOverlaySourceChange()">
                  Custom overlay
                </label>
              </div>

              <div id="stockOverlayInfo" style="display: flex; gap: 12px; align-items: center; background: #252525; border-radius: 8px; padding: 12px;">
                <img src="/api/overlays/standard/preview" alt="Stock overlay"
                     style="width: 72px; height: 72px; object-fit: contain; background: #111; border-radius: 6px; border: 1px solid #333;">
                <div style="font-size: 12px; color: #888;">
                  <strong style="color: #fff;">Arrive Alive Tour (stock)</strong><br>
                  The standard branded frame. Used for this event unless you pick custom artwork.
                </div>
              </div>

              <div id="customOverlayPicker" style="display: none;">
                <input type="text" id="eventOverlaySearch" placeholder="Search overlays by name..."
                       oninput="updateOverlayDropdown()" style="margin-bottom: 8px;">
                <select id="eventOverlay" onchange="renderEventOverlayPreview()">
                  <option value="">Select overlay</option>
                  <!-- Options will be populated from database -->
                </select>
                <div id="eventOverlayPreview" style="display: none; margin-top: 12px;">
                  <img id="eventOverlayPreviewImg" src="" alt="Overlay preview"
                       style="width: 120px; height: 120px; object-fit: contain; background: #111; border-radius: 6px; border: 1px solid #333;">
                </div>
                <p style="font-size: 12px; color: #888; margin-top: 8px;">
                  Don't see your artwork? Upload it on the Overlays tab first.
                </p>
              </div>
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
              if (tab.dataset.tab === 'email') {
                loadEmailStatus();
                loadEmailQueue();
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
                <td>\${team.isAdminTeam
                  ? '<span class="badge badge-success">Admin team</span>'
                  : '<span class="badge">Field team</span>'}</td>
                <td>\${new Date(team.createdAt).toLocaleDateString()}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="editTeam('\${team.id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteTeam('\${team.id}')">Delete</button>
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
          document.getElementById('teamIsAdmin').checked = false;
          document.getElementById('teamModalTitle').textContent = 'Add Team';

          if (teamId) {
            const team = teams.find(t => t.id === teamId);
            if (team) {
              document.getElementById('teamId').value = team.id;
              document.getElementById('teamName').value = team.name;
              document.getElementById('teamCode').value = team.code;
              document.getElementById('teamIsAdmin').checked = !!team.isAdminTeam;
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
          const isAdminTeam = document.getElementById('teamIsAdmin').checked;

          try {
            const url = id ? API_BASE + '/teams/' + id : API_BASE + '/teams';
            const method = id ? 'PUT' : 'POST';

            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, code, isAdminTeam })
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
            // The Overlay column names each event's artwork, which means the
            // overlay list has to be here before the rows are drawn. Normally
            // it is (loaded at sign-in), but not if this tab is opened fast.
            if (overlays.length === 0) {
              await loadOverlaysForDropdown();
            }

            const res = await fetch(url);
            const data = await res.json();
            events = data.data || [];

            // The Data tab picks its events from a checkbox list it fills itself
            // (loadEventsForResults), so nothing else needs updating here.

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
                <td>\${formatEventInstant(event.eventDate, event.timeZone, { hour: undefined, minute: undefined })}</td>
                <td>\${describeEventOverlay(event)}</td>
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
                  <button class="btn btn-danger btn-sm" onclick="deleteEvent('\${event.id}')">Delete</button>
                </td>
              </tr>
            \`).join('');

            document.getElementById('eventsLoading').style.display = 'none';
            document.getElementById('eventsTable').style.display = 'table';
          } catch (err) {
            // Log it too — a silent 'Error loading events' hides real bugs.
            console.error('Error loading events:', err);
            document.getElementById('eventsLoading').textContent = 'Error loading events';
          }
        }

        // Which frame this event's photos will actually come out in.
        //
        // Worth a column of its own: the assignment used to be saved into the
        // wrong field, so an overlay could look picked in the form while the
        // phones quietly used the standard frame all day. Now the table says
        // what the devices will really do.
        function describeEventOverlay(event) {
          if (!event.picturePledgeEnabled) {
            return '<span style="color: #666;">No photos</span>';
          }
          const overlay = overlays.find(o => o.id === event.overlayId);
          // Stock is a deliberate choice now, not a fallback, so it reads as
          // normal rather than as a warning.
          if (!overlay) {
            return '<span class="badge badge-info">Stock overlay</span>';
          }
          if (!overlay.isActive) {
            return '<span class="badge badge-warning">' + escapeHtml(overlay.name) +
              ' (inactive — stock overlay used)</span>';
          }
          return '<span class="badge badge-success">' + escapeHtml(overlay.name) + '</span>';
        }

        // datetime-local inputs want local wall-clock time, not UTC.
        function toDateTimeLocal(isoString) {
          const date = new Date(isoString);
          const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          return local.toISOString().slice(0, 16);
        }

        /**
         * Event times, anchored to the venue's time zone.
         *
         * A timestamp is an instant, and an instant renders differently in every
         * zone. A tablet whose clock was set to UTC showed a 9pm Central end
         * time as 2am, which read as "this event is already over". So an event
         * now carries the zone it is run in, the office picks that zone here,
         * and every screen — portal and tablet — formats against it.
         */
        const TIME_ZONE_CHOICES = [
          ['America/New_York', 'Eastern'],
          ['America/Chicago', 'Central'],
          ['America/Denver', 'Mountain'],
          ['America/Phoenix', 'Arizona'],
          ['America/Los_Angeles', 'Pacific'],
          ['America/Anchorage', 'Alaska'],
          ['Pacific/Honolulu', 'Hawaii'],
        ];

        function browserTimeZone() {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
          } catch (err) {
            return 'America/Chicago';
          }
        }

        /** The wall-clock reading of an instant in a zone, as numbers. */
        function zoneParts(date, timeZone) {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          }).formatToParts(date).reduce((acc, p) => {
            acc[p.type] = p.value;
            return acc;
          }, {});

          return {
            year: Number(parts.year),
            month: Number(parts.month),
            day: Number(parts.day),
            // "24" is how en-US hour12:false spells midnight.
            hour: Number(parts.hour) % 24,
            minute: Number(parts.minute),
            second: Number(parts.second),
          };
        }

        /** How far ahead of UTC the zone is at that instant, in milliseconds. */
        function zoneOffsetMs(date, timeZone) {
          const p = zoneParts(date, timeZone);
          return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
        }

        /** ISO instant -> "YYYY-MM-DDTHH:mm" as read in the venue's zone. */
        function formatInZone(isoString, timeZone) {
          if (!isoString) return '';
          const p = zoneParts(new Date(isoString), timeZone);
          const pad = n => String(n).padStart(2, '0');
          return p.year + '-' + pad(p.month) + '-' + pad(p.day) + 'T' + pad(p.hour) + ':' + pad(p.minute);
        }

        /** "YYYY-MM-DDTHH:mm" typed as venue time -> the ISO instant it means. */
        function parseInZone(localValue, timeZone) {
          if (!localValue) return null;
          // First guess: read the typed time as if it were UTC, then correct by
          // the zone's offset. Applied twice so a time that lands inside a
          // daylight-saving change still comes out right.
          const guess = new Date(localValue + ':00Z').getTime();
          let utc = guess - zoneOffsetMs(new Date(guess), timeZone);
          utc = guess - zoneOffsetMs(new Date(utc), timeZone);
          return new Date(utc).toISOString();
        }

        /** The zone the event form is currently working in. */
        function selectedEventTimeZone() {
          const picker = document.getElementById('eventTimeZone');
          return (picker && picker.value) || browserTimeZone();
        }

        // Offers the US zones plus, when an event was saved somewhere else,
        // whatever zone it already has — so editing never silently moves it.
        function renderTimeZoneOptions(selected) {
          const picker = document.getElementById('eventTimeZone');
          const zones = TIME_ZONE_CHOICES.slice();
          if (selected && !zones.some(z => z[0] === selected)) {
            zones.unshift([selected, selected]);
          }
          picker.innerHTML = zones
            .map(z => '<option value="' + escapeHtml(z[0]) + '"' +
              (z[0] === selected ? ' selected' : '') + '>' +
              escapeHtml(z[1]) + ' — ' + escapeHtml(z[0]) + '</option>')
            .join('');
          updateTimeZoneLabel();
        }

        function updateTimeZoneLabel() {
          const zone = selectedEventTimeZone();
          const match = TIME_ZONE_CHOICES.find(z => z[0] === zone);
          document.getElementById('eventTimeZoneLabel').textContent = match ? match[1] + ' time' : zone;
        }

        /** Event times as the venue reads them, for tables and badges. */
        function formatEventInstant(isoString, timeZone, options) {
          if (!isoString) return '';
          const zone = timeZone || browserTimeZone();
          const settings = Object.assign(
            { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit' },
            options || {}
          );
          try {
            return new Intl.DateTimeFormat('en-US', settings).format(new Date(isoString));
          } catch (err) {
            // An unknown zone must not blank out the whole table.
            return new Date(isoString).toLocaleString();
          }
        }

        // The event form offers exactly the surveys that have been built on the
        // Surveys tab — nothing is hardcoded, so a new survey is selectable as
        // soon as it is created.
        // Fetched fresh every time the event form opens, so a survey created a
        // minute ago is selectable. Always includes inactive ones: an event may
        // still be using a survey that was switched off.
        let eventFormSurveyTypes = [];

        async function loadEventFormSurveyTypes() {
          const res = await fetch(API_BASE + '/surveys/types?includeInactive=true');
          const raw = await res.text();
          let data = null;
          try { data = JSON.parse(raw); } catch (parseErr) { data = null; }
          if (!res.ok || !data || !data.data) {
            const reason = (data && data.error && data.error.message) || raw.slice(0, 200)
              || ('server returned ' + res.status);
            throw new Error(reason);
          }
          eventFormSurveyTypes = data.data;
          return eventFormSurveyTypes;
        }

        async function renderEventSurveyTypes(selectedSlugs) {
          const container = document.getElementById('eventSurveyTypes');
          const selected = selectedSlugs || [];
          container.innerHTML = '<span style="color: #888; font-size: 13px;">Loading your surveys…</span>';

          let types = [];
          try {
            types = await loadEventFormSurveyTypes();
          } catch (err) {
            console.error('Could not load survey types:', err);
            // Fall back to whatever was loaded before rather than leaving the
            // admin with no way to pick a survey.
            types = eventFormSurveyTypes;
            if (types.length === 0) {
              container.innerHTML = '<span style="color: #ff6b6b; font-size: 13px;">Could not load your surveys: '
                + escapeHtml(err && err.message ? err.message : String(err)) + '</span>';
              return;
            }
          }

          // Inactive surveys stay listed if this event already uses them,
          // otherwise editing the event would quietly drop them.
          const shown = types.filter(t => t.isActive || selected.includes(t.slug));

          if (shown.length === 0) {
            container.innerHTML = '<span style="color: #888; font-size: 13px;">'
              + 'No active surveys yet. Build one on the Surveys tab and it will appear here.</span>';
            return;
          }

          container.innerHTML = shown.map(function (t) {
            const count = (t.questions || []).length;
            return '<label class="checkbox-item">'
              + '<input type="checkbox" name="surveyTypes" value="' + escapeHtml(t.slug) + '"'
              + (selected.includes(t.slug) ? ' checked' : '') + '> '
              + escapeHtml(t.name)
              + '<span style="color: #666; font-size: 12px; margin-left: 6px;">'
              + count + (count === 1 ? ' question' : ' questions')
              + (t.isActive ? '' : ' · inactive')
              + '</span>'
              + '</label>';
          }).join('');
        }

        function openEventModal(eventId = null) {
          document.getElementById('eventId').value = '';
          document.getElementById('eventTeam').value = '';
          document.getElementById('eventVenueName').value = '';
          document.getElementById('eventVenueCity').value = '';
          document.getElementById('eventVenueState').value = '';
          document.getElementById('eventDate').value = '';
          document.getElementById('eventEndAt').value = '';
          // A new event is assumed to run in the zone the office is sitting in;
          // the picker is right there if the venue is somewhere else.
          renderTimeZoneOptions(browserTimeZone());
          document.getElementById('eventOverlaySearch').value = '';
          document.getElementById('eventOverlay').value = '';
          // New events default to the stock frame.
          setEventOverlaySource('stock');
          document.getElementById('eventStatus').value = 'active';
          document.getElementById('eventStatusGroup').style.display = 'none';
          document.getElementById('eventPicturePledge').checked = false;
          renderEventSurveyTypes([]);
          document.getElementById('eventModalTitle').textContent = 'Add Event';

          if (eventId) {
            const event = events.find(e => e.id === eventId);
            if (event) {
              document.getElementById('eventId').value = event.id;
              document.getElementById('eventTeam').value = event.teamId;
              document.getElementById('eventVenueName').value = event.venueName;
              document.getElementById('eventVenueCity').value = event.venueCity;
              document.getElementById('eventVenueState').value = event.venueState;

              // Times are shown in the event's own zone, so a tour manager in
              // another state edits the venue's clock rather than their own.
              // Events saved before zones existed fall back to this browser.
              const zone = event.timeZone || browserTimeZone();
              renderTimeZoneOptions(zone);

              document.getElementById('eventDate').value = formatInZone(event.eventDate, zone);
              document.getElementById('eventEndAt').value = event.eventEndAt
                ? formatInZone(event.eventEndAt, zone)
                : '';

              // Read back from overlayId, matching what the dropdown stores.
              // Reading overlayType left the box blank on every edit, so
              // re-saving an event quietly wiped its artwork.
              // No overlayId means this event is on the stock frame.
              document.getElementById('eventOverlay').value = event.overlayId || '';
              setEventOverlaySource(event.overlayId ? 'custom' : 'stock');
              document.getElementById('eventStatus').value = event.status;
              document.getElementById('eventStatusGroup').style.display = 'block';
              document.getElementById('eventPicturePledge').checked = event.picturePledgeEnabled || false;

              // Tick the surveys this event already collects
              renderEventSurveyTypes(event.surveyTypes || []);

              document.getElementById('eventModalTitle').textContent = 'Edit Event';
            }
          }

          document.getElementById('eventModal').classList.add('active');
        }

        function closeEventModal() {
          document.getElementById('eventModal').classList.remove('active');
        }

        // Which overlay the event form is currently set to: 'stock' or 'custom'.
        function getEventOverlaySource() {
          const picked = document.querySelector('input[name="eventOverlaySource"]:checked');
          return picked ? picked.value : 'stock';
        }

        function setEventOverlaySource(source) {
          document.querySelectorAll('input[name="eventOverlaySource"]').forEach(radio => {
            radio.checked = radio.value === source;
          });
          onEventOverlaySourceChange();
        }

        // Show the stock blurb or the custom search + dropdown, never both.
        function onEventOverlaySourceChange() {
          const custom = getEventOverlaySource() === 'custom';
          document.getElementById('stockOverlayInfo').style.display = custom ? 'none' : 'flex';
          document.getElementById('customOverlayPicker').style.display = custom ? 'block' : 'none';
          if (custom) {
            updateOverlayDropdown();
            renderEventOverlayPreview();
          }
        }

        // Thumbnail of the picked artwork, so a wrong pick is caught in the
        // form rather than on a tablet at the venue.
        function renderEventOverlayPreview() {
          const overlayId = document.getElementById('eventOverlay').value;
          const wrap = document.getElementById('eventOverlayPreview');
          const img = document.getElementById('eventOverlayPreviewImg');

          if (!overlayId) {
            wrap.style.display = 'none';
            img.src = '';
            return;
          }

          img.src = API_BASE + '/overlays/' + overlayId + '/preview';
          wrap.style.display = 'block';
        }

        function editEvent(eventId) {
          openEventModal(eventId);
        }

        async function completeEvent(eventId) {
          if (!confirm(
            'End this event?\\n\\n' +
            'Every tablet and phone at the venue will go back to their menu and stop ' +
            'collecting for it. Only do this if the crew is finished — normally the ' +
            'facilitator ends the event on the device when they are done.'
          )) return;

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
        //
        // Photos are deleted once the event has been ENDED — by the facilitator
        // on the device or "Complete" here — not when the scheduled end time
        // passes, because events run late. An event that is over but not yet
        // purged is not stuck: the purge holds off until the tablets have
        // finished uploading their surveys and pledge photos. The badge is
        // clickable and says exactly what it is waiting on.
        function describePurge(event) {
          if (event.photosPurgedAt) {
            return '<span class="badge badge-success">Deleted ' +
              formatEventInstant(event.photosPurgedAt, event.timeZone) + '</span>';
          }

          if (event.status === 'completed') {
            return '<span class="badge badge-warning" style="cursor: pointer;" ' +
              'onclick="showPurgeReadiness(\\'' + event.id + '\\')" ' +
              'title="Click to see what the purge is waiting for">Waiting for uploads</span>';
          }

          const endsAt = event.eventEndAt ? new Date(event.eventEndAt) : null;

          if (!endsAt) {
            return '<span class="badge badge-warning">When ended</span>';
          }

          if (endsAt <= new Date()) {
            return '<span class="badge badge-info" ' +
              'title="Past its scheduled end. The crew may still be working — photos are ' +
              'deleted once the event is ended, or 6 hours after the scheduled end if ' +
              'nobody ends it.">Running late</span>';
          }

          return '<span class="badge badge-info">When ended</span>';
        }

        // "Why hasn't this deleted the photos yet?" answered on screen.
        async function showPurgeReadiness(eventId) {
          try {
            const res = await fetch(API_BASE + '/events/' + eventId + '/purge-readiness');
            const data = await res.json();

            if (data.error) {
              alert('Could not check: ' + data.error.message);
              return;
            }

            const readiness = data.data;

            if (!readiness.isOver) {
              alert('This event has not been ended yet, so nothing is deleted. The ' +
                'facilitator ends it on the device when the crew is finished, or you ' +
                'can press "Complete". An event nobody ends is closed automatically 6 ' +
                'hours after its scheduled end time.');
              return;
            }

            if (readiness.ready) {
              alert('Everything is in. The photos and email addresses for this event ' +
                'are deleted on the next check (within 5 minutes), or press "Purge Now".');
              return;
            }

            alert(
              'The automatic deletion is waiting for:\\n\\n' +
              readiness.waitingOn.map(reason => '  - ' + reason).join('\\n') +
              '\\n\\nIt runs on its own as soon as those finish, and no later than 24 ' +
              'hours after the event ended. "Purge Now" does it immediately.'
            );
          } catch (err) {
            console.error('Error checking purge readiness:', err);
            alert('Error checking the event');
          }
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

        // Two dialogs on purpose. The first says exactly what is about to be
        // destroyed; the second stops it being done by reflex. Deleting a team
        // or an event cascades through every survey answer attached to it and
        // there is no undo short of last night's backup.
        function confirmHardDelete(title, lines) {
          if (!confirm(title + '\\n\\n' + lines.join('\\n') + '\\n\\nThis CANNOT be undone.')) {
            return false;
          }
          const typed = prompt('Type DELETE to confirm.');
          return typed !== null && typed.trim().toUpperCase() === 'DELETE';
        }

        async function deleteEvent(eventId) {
          let impact;
          try {
            const res = await fetch(API_BASE + '/events/' + eventId + '/deletion-impact');
            const data = await res.json();
            if (data.error) {
              alert('Could not check the event: ' + data.error.message);
              return;
            }
            impact = data.data;
          } catch (err) {
            console.error('Error loading deletion impact:', err);
            alert('Could not check the event before deleting. Nothing was changed.');
            return;
          }

          const ok = confirmHardDelete(
            'Delete the event "' + impact.venueName + '" (' + impact.venueCity + ', ' + impact.venueState + ')?',
            [
              'This permanently deletes:',
              '  - ' + impact.surveyResponseCount + ' survey response(s)',
              '  - ' + impact.pledgeCount + ' pledge(s)',
              '  - ' + impact.photoCount + ' photo(s)',
              '  - ' + impact.externalImportCount + ' imported survey file(s)',
              '',
              'To erase photos and email addresses but KEEP the survey answers,',
              'press "Purge Now" instead.'
            ]
          );
          if (!ok) return;

          try {
            const res = await fetch(API_BASE + '/events/' + eventId + '?confirm=DELETE', {
              method: 'DELETE'
            });
            const data = await res.json();

            if (data.error) {
              alert('Could not delete: ' + data.error.message);
              return;
            }

            alert('Deleted "' + data.data.venueName + '".');
            loadEvents();
          } catch (err) {
            console.error('Error deleting event:', err);
            alert('Error deleting event');
          }
        }

        async function deleteTeam(teamId) {
          let impact;
          try {
            const res = await fetch(API_BASE + '/teams/' + teamId + '/deletion-impact');
            const data = await res.json();
            if (data.error) {
              alert('Could not check the team: ' + data.error.message);
              return;
            }
            impact = data.data;
          } catch (err) {
            console.error('Error loading deletion impact:', err);
            alert('Could not check the team before deleting. Nothing was changed.');
            return;
          }

          const ok = confirmHardDelete(
            'Delete the team "' + impact.name + '" (' + impact.code + ')?',
            [
              'A team owns its events, so this covers EVERY tour date it has',
              'ever worked - not just the current one.',
              '',
              'This permanently deletes:',
              '  - ' + impact.eventCount + ' event(s)',
              '  - ' + impact.surveyResponseCount + ' survey response(s)',
              '  - ' + impact.pledgeCount + ' pledge(s)',
              '  - ' + impact.photoCount + ' photo(s)',
              '  - ' + impact.deviceCount + ' paired tablet(s)/phone(s)',
              '',
              'Any tablet using this team code will stop working until it is',
              'set up again with a different code.'
            ]
          );
          if (!ok) return;

          try {
            const res = await fetch(API_BASE + '/teams/' + teamId + '?confirm=DELETE', {
              method: 'DELETE'
            });
            const data = await res.json();

            if (data.error) {
              alert('Could not delete: ' + data.error.message);
              return;
            }

            alert('Deleted "' + data.data.name + '".');
            // The Events tab is now stale — this team's events went with it.
            loadTeams();
            loadEvents();
          } catch (err) {
            console.error('Error deleting team:', err);
            alert('Error deleting team');
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
          // The dropdown's values are overlay IDs (see updateOverlayDropdown),
          // so this is an overlayId — not the legacy overlayType slug. Sending
          // it as overlayType was the bug that stopped a picked overlay ever
          // reaching the phones: the server resolves artwork through the
          // overlayId relation, which stayed empty, so every event silently
          // fell back to the standard frame.
          // Stock means "no custom artwork": the server resolves an event with
          // no overlayId to the standard Arrive Alive frame, so this is left
          // empty rather than pointing at a row.
          const overlaySource = getEventOverlaySource();
          const overlayId = overlaySource === 'custom'
            ? document.getElementById('eventOverlay').value
            : '';
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

          // Picture Pledge no longer blocks on artwork: an event with nothing
          // picked gets the stock frame. Only an unfinished custom pick is an
          // error, and only when there are photos to brand.
          if (picturePledgeEnabled && overlaySource === 'custom' && !overlayId) {
            alert('Custom overlay is selected but none is picked. Choose one from the list, upload artwork on the Overlays tab, or switch back to Stock overlay.');
            return;
          }

          try {
            const url = id ? API_BASE + '/events/' + id : API_BASE + '/events';
            const method = id ? 'PUT' : 'POST';

            // Both times are read as venue-local wall clock and sent as full ISO
            // instants, so neither the server's zone nor the tablet's can shift
            // them. The zone travels with the event for display.
            const timeZone = selectedEventTimeZone();

            const body = {
              venueName,
              venueCity,
              venueState,
              eventDate: parseInZone(eventDate, timeZone),
              eventEndAt: eventEndAtRaw ? parseInZone(eventEndAtRaw, timeZone) : null,
              timeZone,
              surveyTypes,
              picturePledgeEnabled
            };

            if (!id) {
              body.teamId = teamId;
              // Legacy slug column. Kept at its default rather than filled with
              // the overlay id, which is what used to happen.
              body.overlayType = 'default';
              // Create rejects null here, so only send it when one was picked.
              if (overlayId) body.overlayId = overlayId;
            }

            if (id) {
              body.status = status;
              // On edit, null is meaningful: it clears the assignment.
              body.overlayId = overlayId || null;
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
          const searchBox = document.getElementById('eventOverlaySearch');
          const term = (searchBox ? searchBox.value : '').trim().toLowerCase();

          select.innerHTML = '<option value="">Select overlay</option>';

          // Add active overlays from database, narrowed by the search box.
          // A team with dozens of school-specific frames can't scroll a flat
          // dropdown, so typing filters it.
          const activeOverlays = overlays.filter(o => o.isActive);
          const matching = term
            ? activeOverlays.filter(o => (o.name || '').toLowerCase().includes(term))
            : activeOverlays;

          // Whatever this event is already on stays pickable even if it has
          // since been deactivated or is filtered out by the search — losing it
          // here would quietly move the event onto the stock frame on save.
          const shown = matching.slice();
          if (currentValue && !shown.some(o => o.id === currentValue)) {
            const assigned = overlays.find(o => o.id === currentValue);
            if (assigned) {
              shown.unshift({
                id: assigned.id,
                name: assigned.name + (assigned.isActive ? '' : ' (inactive)'),
              });
            }
          }

          shown.forEach(overlay => {
            const option = document.createElement('option');
            option.value = overlay.id;
            option.textContent = overlay.name;
            select.appendChild(option);
          });

          // Say which of the two empty cases this is — nothing uploaded at all,
          // or nothing matching what was typed. Driven by the search result,
          // not by the list: the current pick is carried above regardless, and
          // its presence must not swallow a "nothing matched" message.
          if (matching.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = activeOverlays.length === 0
              ? "No overlays available - add one in Overlays tab"
              : 'No overlays match "' + term + '"';
            option.disabled = true;
            select.appendChild(option);
          }

          // Keep the current pick only if it survived the filter, otherwise the
          // form would report an overlay that is no longer visible.
          select.value = shown.some(o => o.id === currentValue) ? currentValue : '';

          // Keep the thumbnail honest — a pick dropped by the filter must not
          // leave its preview on screen.
          renderEventOverlayPreview();
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

        /**
         * The filters every part of the Data tab reads from: the team, the
         * survey type, and the ticked events.
         *
         * Every number on this tab is built from the same query string, so the
         * counts, the pie charts and the spreadsheets can never disagree about
         * which events they are describing. Ticking three venues used to leave
         * the counts showing the whole tour, because only a single event id was
         * ever sent.
         */
        function dataTabParams(options) {
          const params = new URLSearchParams();
          const teamId = document.getElementById('dataTeamFilter').value;
          const eventIds = getSelectedEventIds();

          if (teamId) params.set('teamId', teamId);
          if (eventIds.length > 0) params.set('eventIds', eventIds.join(','));

          if (options && options.withSurveyType) {
            const slug = document.getElementById('dataSurveyTypeFilter').value;
            if (slug) params.set('surveyTypeSlug', slug);
          }

          return params;
        }

        /** "3 selected events" / "all events" — used to label what is on screen. */
        function selectionLabel() {
          const count = getSelectedEventIds().length;
          if (count === 0) return 'all events';
          return count === 1 ? '1 selected event' : count + ' selected events';
        }

        async function loadAnalytics() {
          const params = dataTabParams();

          try {
            const res = await fetch(API_BASE + '/admin/analytics?' + params.toString());
            const data = await res.json();
            analytics = data.data;

            document.getElementById('statTotalSurveys').textContent = analytics.totalSurveys;
            document.getElementById('statTotalPhotos').textContent = analytics.totalPhotos;
            document.getElementById('statScopeSurveys').textContent = 'across ' + selectionLabel();
            document.getElementById('statScopePhotos').textContent = 'across ' + selectionLabel();

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

        // Which events are ticked, held here rather than read off the DOM.
        // Sorting and searching re-render the list, and a tick that only lived
        // in the markup would vanish with it — silently shrinking the report.
        let selectedEventIds = new Set();

        // The events matching the search box, in the chosen order.
        function visibleEventsForData() {
          const searchBox = document.getElementById('eventSearchFilter');
          const term = (searchBox ? searchBox.value : '').trim().toLowerCase();
          const sortBox = document.getElementById('eventSortFilter');
          const sort = sortBox ? sortBox.value : 'date-desc';

          const matches = term
            ? allEventsForData.filter(e =>
                (e.venueName || '').toLowerCase().includes(term) ||
                (e.venueCity || '').toLowerCase().includes(term) ||
                (e.venueState || '').toLowerCase().includes(term))
            : allEventsForData.slice();

          // Case-insensitive so "austin high" and "Austin High" sort together.
          const byName = (a, b) =>
            (a.venueName || '').localeCompare(b.venueName || '', undefined, { sensitivity: 'base' });
          const byDate = (a, b) => new Date(a.eventDate) - new Date(b.eventDate);
          // Within a state, keep venues alphabetical — otherwise every event in
          // TX comes back in an arbitrary order.
          const byState = (a, b) =>
            (a.venueState || '').localeCompare(b.venueState || '', undefined, { sensitivity: 'base' })
            || byName(a, b);

          const comparators = {
            'date-desc': (a, b) => byDate(b, a),
            'date-asc': byDate,
            'name-asc': byName,
            'name-desc': (a, b) => byName(b, a),
            'state-asc': byState,
            'state-desc': (a, b) => byState(b, a),
          };

          return matches.sort(comparators[sort] || comparators['date-desc']);
        }

        function renderEventsCheckboxList() {
          const container = document.getElementById('eventsCheckboxList');

          if (allEventsForData.length === 0) {
            container.innerHTML = '<p class="text-muted">No events found.</p>';
            updateSelectedEventsCount();
            return;
          }

          const visible = visibleEventsForData();

          if (visible.length === 0) {
            container.innerHTML = '<p class="text-muted">No events match your search.</p>';
            updateSelectedEventsCount();
            return;
          }

          container.innerHTML = visible.map(event => \`
            <label class="checkbox-item" style="display: flex; padding: 8px; border-bottom: 1px solid #333; cursor: pointer;">
              <input type="checkbox" class="event-checkbox" value="\${event.id}" \${selectedEventIds.has(event.id) ? 'checked' : ''} onchange="toggleEventSelection('\${event.id}', this.checked)" style="margin-right: 12px;">
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

        function toggleEventSelection(eventId, checked) {
          if (checked) {
            selectedEventIds.add(eventId);
          } else {
            selectedEventIds.delete(eventId);
          }
          updateSelectedEventsCount();
          refreshDataForSelection();
        }

        /**
         * Re-read the counts and the responses table for whatever is ticked.
         *
         * Debounced because ticking several events in a row would otherwise
         * fire a request per click, and the answers can come back out of order.
         */
        let selectionRefreshTimer = null;
        function refreshDataForSelection() {
          clearTimeout(selectionRefreshTimer);
          selectionRefreshTimer = setTimeout(() => {
            loadSurveyResponses(); // refreshes the counts too
          }, 250);
        }

        function getSelectedEventIds() {
          // Only events currently loaded count — switching the team filter
          // must not leave another team's events in the report.
          return allEventsForData
            .filter(e => selectedEventIds.has(e.id))
            .map(e => e.id);
        }

        function updateSelectedEventsCount() {
          const selected = getSelectedEventIds();
          const visibleIds = new Set(visibleEventsForData().map(e => e.id));
          const hidden = selected.filter(id => !visibleIds.has(id)).length;

          let text = selected.length + ' event' + (selected.length !== 1 ? 's' : '') + ' selected';
          // Say so out loud: a report built from ticks you can't see on screen
          // is otherwise very confusing.
          if (hidden > 0) text += ' (' + hidden + ' hidden by search)';

          document.getElementById('selectedEventsCount').textContent = text;
        }

        function selectAllEvents() {
          // "All" means everything on screen, matching what the search shows.
          visibleEventsForData().forEach(e => selectedEventIds.add(e.id));
          renderEventsCheckboxList();
          refreshDataForSelection();
        }

        function deselectAllEvents() {
          selectedEventIds.clear();
          renderEventsCheckboxList();
          refreshDataForSelection();
        }

        async function loadSurveyResponses() {
          document.getElementById('responsesLoading').style.display = 'block';
          document.getElementById('responsesTable').style.display = 'none';
          document.getElementById('responsesEmpty').style.display = 'none';

          const params = dataTabParams({ withSurveyType: true });

          try {
            const res = await fetch(API_BASE + '/surveys/responses?' + params.toString());
            const data = await res.json();
            allSurveyResponses = data.data || [];
            // Rows that vanished with the last filter change must not stay
            // ticked, or "Delete Selected" would remove something off screen.
            const visibleIds = new Set(allSurveyResponses.map(r => r.id));
            selectedResponseIds.forEach(id => {
              if (!visibleIds.has(id)) selectedResponseIds.delete(id);
            });

            if (allSurveyResponses.length === 0) {
              document.getElementById('responsesLoading').style.display = 'none';
              document.getElementById('responsesTruncated').style.display = 'none';
              document.getElementById('responsesEmpty').style.display = 'block';
              updateResponseSelectionUi();
              loadAnalytics();
              return;
            }

            renderSurveyResponses();

            // Also refresh analytics
            loadAnalytics();
          } catch (err) {
            document.getElementById('responsesLoading').textContent = 'Error loading responses';
          }
        }

        // How the responses table is currently ordered. Newest first to start,
        // which is what the table did before it could be sorted at all.
        let allSurveyResponses = [];
        let responsesSortKey = 'date';
        let responsesSortDir = 'desc';

        // Surveys ticked for deletion. Held here, not read off the DOM, for the
        // same reason as the event ticks: sorting re-renders the rows.
        let selectedResponseIds = new Set();

        // Same heading clicked twice reverses it; a new heading starts on the
        // order that reads naturally for that column (A–Z, newest first).
        function sortResponsesBy(key) {
          if (responsesSortKey === key) {
            responsesSortDir = responsesSortDir === 'asc' ? 'desc' : 'asc';
          } else {
            responsesSortKey = key;
            responsesSortDir = key === 'date' ? 'desc' : 'asc';
          }
          renderSurveyResponses();
        }

        function renderSurveyResponses() {
          const RESPONSE_LIMIT = 100;
          const text = {
            date: r => r.completedAt || '',
            team: r => (r.team && r.team.name) || '',
            name: r => (r.event && r.event.venueName) || '',
            state: r => (r.event && r.event.venueState) || '',
          };
          const read = text[responsesSortKey] || text.date;

          const sorted = allSurveyResponses.slice().sort((a, b) => {
            let result;
            if (responsesSortKey === 'date') {
              result = new Date(a.completedAt) - new Date(b.completedAt);
            } else {
              result = read(a).localeCompare(read(b), undefined, { sensitivity: 'base' });
              // Ties fall back to newest first so rows don't jump around
              // between renders.
              if (result === 0) result = new Date(b.completedAt) - new Date(a.completedAt);
            }
            return responsesSortDir === 'asc' ? result : -result;
          });

          const arrow = responsesSortDir === 'asc' ? '▲' : '▼';
          ['date', 'team', 'name', 'state'].forEach(key => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            document.getElementById('responsesSort' + label).textContent =
              responsesSortKey === key ? arrow : '';
          });

          const tbody = document.getElementById('responsesBody');
          const shown = sorted.slice(0, RESPONSE_LIMIT);
          tbody.innerHTML = shown.map(r => \`
            <tr>
              <td><input type="checkbox" class="response-checkbox" value="\${r.id}" \${selectedResponseIds.has(r.id) ? 'checked' : ''} onchange="toggleResponseSelection('\${r.id}', this.checked)"></td>
              <td>\${new Date(r.completedAt).toLocaleString()}</td>
              <td>\${r.team ? escapeHtml(r.team.name) : '-'}</td>
              <td>\${r.event ? escapeHtml(r.event.venueName) : '-'}</td>
              <td>\${r.event && r.event.venueState ? escapeHtml(r.event.venueState) : '-'}</td>
              <td><span class="badge badge-info">\${escapeHtml(r.surveyTypeSlug)}</span></td>
              <td>\${r.ageRange || '-'}</td>
              <td>\${r.durationSeconds ? r.durationSeconds + 's' : '-'}</td>
              <td><button class="btn btn-danger btn-sm" onclick="deleteSurveyResponse('\${r.id}')">Delete</button></td>
            </tr>
          \`).join('');

          updateResponseSelectionUi();

          // The table has always shown at most 100 rows. Say so, rather than
          // letting it look like the whole data set.
          const truncated = document.getElementById('responsesTruncated');
          if (sorted.length > RESPONSE_LIMIT) {
            truncated.textContent = 'Showing the first ' + RESPONSE_LIMIT + ' of ' +
              sorted.length + ' responses. Narrow the filters above to see the rest.';
            truncated.style.display = 'block';
          } else {
            truncated.style.display = 'none';
          }

          document.getElementById('responsesLoading').style.display = 'none';
          document.getElementById('responsesEmpty').style.display = 'none';
          document.getElementById('responsesTable').style.display = 'table';
        }

        /**
         * Removing individual surveys.
         *
         * A practice run or a double tap used to be stuck in the numbers for
         * good: the only delete on offer took the whole event with it. These
         * remove survey rows only — the event, its photos and its pledges stay
         * exactly as they are.
         */

        function toggleResponseSelection(id, checked) {
          if (checked) {
            selectedResponseIds.add(id);
          } else {
            selectedResponseIds.delete(id);
          }
          updateResponseSelectionUi();
        }

        // Ticks the rows on screen. Rows past the 100-row display limit are
        // deliberately left alone — nothing gets deleted that can't be seen.
        function toggleAllResponses(checked) {
          document.querySelectorAll('.response-checkbox').forEach(cb => {
            cb.checked = checked;
            if (checked) {
              selectedResponseIds.add(cb.value);
            } else {
              selectedResponseIds.delete(cb.value);
            }
          });
          updateResponseSelectionUi();
        }

        function updateResponseSelectionUi() {
          const count = selectedResponseIds.size;
          const button = document.getElementById('deleteSelectedResponses');
          if (!button) return;

          button.textContent = count > 0 ? 'Delete Selected (' + count + ')' : 'Delete Selected';
          button.disabled = count === 0;

          const headerBox = document.getElementById('responsesSelectAll');
          if (headerBox) {
            const boxes = document.querySelectorAll('.response-checkbox');
            headerBox.checked = boxes.length > 0 &&
              Array.from(boxes).every(cb => selectedResponseIds.has(cb.value));
          }
        }

        async function deleteSurveyResponse(id) {
          const response = allSurveyResponses.find(r => r.id === id);
          const where = response && response.event ? response.event.venueName : 'this event';
          const when = response ? new Date(response.completedAt).toLocaleString() : '';

          if (!confirm(
            'Delete this one survey?\\n\\n' +
            where + (when ? ' — ' + when : '') + '\\n\\n' +
            'The event, its photos and everyone else\\'s answers are kept.\\n' +
            'This cannot be undone.'
          )) return;

          try {
            const res = await fetch(API_BASE + '/surveys/responses/' + id, { method: 'DELETE' });
            const data = await res.json();

            if (data.error) {
              alert('Could not delete: ' + data.error.message);
              return;
            }

            selectedResponseIds.delete(id);
            loadSurveyResponses();
          } catch (err) {
            console.error('Error deleting survey response:', err);
            alert('Error deleting survey');
          }
        }

        async function deleteSelectedResponses() {
          const ids = Array.from(selectedResponseIds);
          if (ids.length === 0) return;

          if (!confirm(
            'Delete ' + ids.length + ' survey' + (ids.length === 1 ? '' : 's') + '?\\n\\n' +
            'Only these answers are removed. The events they belong to, their\\n' +
            'photos and every other survey are kept.\\n\\n' +
            'This cannot be undone.'
          )) return;

          try {
            const res = await fetch(API_BASE + '/surveys/responses/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids, confirm: 'DELETE' })
            });
            const data = await res.json();

            if (data.error) {
              alert('Could not delete: ' + data.error.message);
              return;
            }

            selectedResponseIds.clear();

            const missing = (data.data.missingIds || []).length;
            if (missing > 0) {
              alert('Deleted ' + data.data.deletedCount + ' survey(s). ' + missing +
                ' had already been removed by someone else.');
            }

            loadSurveyResponses();
          } catch (err) {
            console.error('Error deleting survey responses:', err);
            alert('Error deleting surveys');
          }
        }

        /**
         * Download the selected events as a spreadsheet.
         *
         * kind is 'summary' (the pie chart numbers as a table), 'responses'
         * (one row per survey taken) or 'legacy' (the column layout the survey
         * results were kept in before this app). The server builds the file from
         * the same filters shown on this tab, so a download always matches the
         * screen.
         */
        async function downloadSpreadsheet(kind, button) {
          const teamId = document.getElementById('dataTeamFilter').value;
          const surveyTypeSlug = document.getElementById('dataSurveyTypeFilter').value;
          const selectedEventIds = getSelectedEventIds();

          if (selectedEventIds.length === 0) {
            alert('Please select at least one event to download a spreadsheet.');
            return;
          }

          const params = new URLSearchParams();
          params.set('eventIds', selectedEventIds.join(','));
          if (teamId) params.set('teamId', teamId);
          if (surveyTypeSlug) params.set('surveyTypeSlug', surveyTypeSlug);

          const originalText = button ? button.textContent : '';
          if (button) {
            button.textContent = 'Preparing...';
            button.disabled = true;
          }

          try {
            const res = await fetch(API_BASE + '/surveys/export/' + kind + '.csv?' + params.toString());
            if (!res.ok) {
              throw new Error('Server responded ' + res.status);
            }

            const csv = await res.text();

            // A file holding nothing but column headings looks like a broken
            // download rather than an empty selection, so say so instead.
            const dataRows = csv.split('\\r\\n').filter(line => line.length > 0).length - 1;
            if (dataRows < 1) {
              alert('No survey responses match the current filters, so there is nothing to put in a spreadsheet.');
              return;
            }

            // Prefer the name the server chose; it carries today's date.
            let filename = kind === 'summary'
              ? 'survey-summary.csv'
              : kind === 'legacy'
              ? 'survey-archive-format.csv'
              : 'survey-responses.csv';
            const disposition = res.headers.get('content-disposition') || '';
            const match = /filename="([^"]+)"/.exec(disposition);
            if (match) filename = match[1];

            const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
          } catch (error) {
            console.error('Spreadsheet download failed:', error);
            alert('Could not build the spreadsheet: ' + error.message);
          } finally {
            if (button) {
              button.textContent = originalText;
              button.disabled = false;
            }
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

          // Scoped to whatever is ticked on the Data tab. These charts are what
          // gets read out in a debrief, and a chart labelled with one venue but
          // built from the whole tour's answers is worse than no chart.
          const params = dataTabParams();
          const scope = selectionLabel();

          try {
            const res = await fetch(API_BASE + '/surveys/results/' + slug + '?' + params.toString());
            const data = await res.json();

            if (data.error) {
              document.getElementById('surveyResultsContent').innerHTML = '<p class="text-muted">' + data.error.message + '</p>';
              return;
            }

            const results = data.data;

            if (results.totalResponses === 0) {
              document.getElementById('surveyResultsContent').innerHTML =
                '<p class="text-muted">No responses for this survey across ' + escapeHtml(scope) +
                '. Tick the events you want on the Data tab.</p>';
              return;
            }

            let html = \`
              <div style="margin-bottom: 20px;">
                <p style="color: #888;">Total Responses: <strong style="color: #fff;">\${results.totalResponses}</strong></p>
                <p style="color: #888; font-size: 13px;">Counting \${escapeHtml(scope)} — change the tick boxes on the Data tab to narrow this down.</p>
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

        // ===== Email =====
        //
        // Pledge emails are the one part of the system with no visible result:
        // the tablet says "Sent!" the moment the pledge is saved, long before
        // anything leaves the server. If the key is missing or the sending
        // domain is not verified, every email fails in silence. This tab is
        // where that becomes visible.

        // Turn the email provider's own error into something actionable.
        //
        // "HTTP 401: unauthorized" is technically accurate and tells a
        // non-technical reader nothing at all — least of all that the fix is a
        // fresh key rather than anything to do with the address they typed.
        // The raw text is still shown underneath; this only adds the meaning.
        function explainEmailError(raw) {
          const text = String(raw || '');
          // Named from the error itself so the advice matches whichever
          // provider actually rejected the send.
          const provider = /sendgrid/i.test(text) ? 'SendGrid' : 'Resend';
          const keysPage = provider === 'Resend' ? 'resend.com/api-keys' : 'your SendGrid dashboard';

          // Checked before the 401 branch on purpose: this message contains a
          // status code too, and it is the opposite problem. The key is fine;
          // the request never got out of the building.
          if (/^Blocked before reaching/i.test(text)) {
            return 'The request never reached ' + provider + ', so the key is almost certainly not the problem. ' +
              'Something on this network answered instead — usually antivirus or security software inspecting ' +
              'secure connections, a company firewall, or a guest Wi-Fi login page. ' +
              'Try the computer on a different network (a phone hotspot is the quickest test). ' +
              'If that works, api.resend.com needs to be allowed through whatever is filtering the first network.';
          }
          if (/HTTP 401|unauthorized|invalid api key|API key is invalid|authorization grant is invalid/i.test(text)) {
            return provider + ' is refusing the key on this server. Keys are shown only once when you create them, ' +
              'so a key that was half-copied, later deleted, or belongs to a different account looks exactly like this. ' +
              'Create a fresh key at ' + keysPage + ', put it in the settings file, then restart the server.';
          }
          if (/not verified|verify a domain|domain is not/i.test(text)) {
            return 'The key works, but ' + provider + ' will not send from this address until the domain it belongs ' +
              'to is verified on that account. Check the Domains page.';
          }
          if (/HTTP 403|forbidden|permission/i.test(text)) {
            return 'The key is recognised but is not allowed to send. It needs sending permission on the ' +
              provider + ' account.';
          }
          if (/HTTP 422|validation_error/i.test(text)) {
            return provider + ' rejected the address it was asked to send to. Test with a real address you can open.';
          }
          if (/HTTP 429|rate limit|too many/i.test(text)) {
            return provider + ' is rate-limiting this account — too many emails too quickly. Wait a minute and try again.';
          }
          if (/fetch failed|ENOTFOUND|ETIMEDOUT|network/i.test(text)) {
            return 'The server could not reach ' + provider + ' at all. Check the desktop has internet.';
          }
          return null;
        }

        // Compares the key held by the running server against the key sitting
        // in the settings file. Silence here means they agree; everything this
        // renders is a reason that editing the file has not taken effect, which
        // is otherwise indistinguishable from having typed the key wrong.
        function renderEnvFileCheck(s) {
          const f = s.envFile;
          if (!f) return '';

          const red = 'background: #3a1a1a; border-left: 4px solid #dc3545; padding: 16px; border-radius: 6px; margin-bottom: 16px;';
          const amber = 'background: #3a2f1a; border-left: 4px solid #ffc107; padding: 16px; border-radius: 6px; margin-bottom: 16px;';
          const body = 'color: #ccc; margin: 8px 0 0;';
          let html = '';

          // Notepad appends .txt unless "Save as type" is changed, and Windows
          // hides known extensions, so the wrong file looks like the right one.
          const notepadFiles = (f.strayFiles || []).filter(function (n) {
            return /\.(txt|rtf)$/i.test(n);
          });
          if (notepadFiles.length) {
            html += '<div style="' + amber + '"><strong style="color: #ffc107;">There is an extra settings file: ' +
              escapeHtml(notepadFiles.join(', ')) + '</strong>' +
              '<p style="' + body + '">The server only reads the one called <strong>.env</strong>. ' +
              "If you edited the file above by mistake, your key went somewhere nothing reads. " +
              'Restarting the server renames it automatically.</p></div>';
          }

          if (!f.exists) {
            return html + '<div style="' + red + '"><strong style="color: #ff6b6b;">The settings file is missing.</strong>' +
              '<p style="' + body + '">Nothing was found at ' + escapeHtml(f.path) + '. See step 4 of the desktop guide.</p></div>';
          }

          if (f.occurrences === 0) {
            return html + '<div style="' + amber + '"><strong style="color: #ffc107;">The settings file has no key line in it.</strong>' +
              '<p style="' + body + '">' + escapeHtml(f.path) + " doesn't contain a line starting with " +
              (s.provider === 'sendgrid' ? 'SENDGRID_API_KEY' : 'RESEND_API_KEY') +
              '. The key the server is using came from somewhere else.</p></div>';
          }

          if (!f.matchesActive) {
            html += '<div style="' + red + '"><strong style="color: #ff6b6b;">The server is NOT using the key in your settings file.</strong>' +
              '<p style="' + body + '">The file holds a different key (' +
              escapeHtml(f.keyPreview || '') + '&hellip;, ' + f.keyLength + ' characters) from the one shown above. ' +
              'Until that is fixed, correcting the key in the file changes nothing.</p>';

            if (f.editedSinceStart) {
              html += '<p style="' + body + '"><strong>Cause: the server has not been restarted.</strong> ' +
                'You saved the file at ' + formatWhen(f.modifiedAt) + ', but this server started at ' +
                formatWhen(f.serverStartedAt) + ' and still has the old key in memory. Restart it.</p>';
            } else {
              html += '<p style="' + body + '"><strong>Cause: something on this computer is overriding the file.</strong> ' +
                'The file was last saved at ' + formatWhen(f.modifiedAt) + ', before this server started at ' +
                formatWhen(f.serverStartedAt) + " — so a restart will not help. Almost always this is a Windows " +
                'environment variable with the same name, which wins over the file every time.</p>' +
                '<p style="' + body + '">To clear it: press the Windows key, type <strong>environment variables</strong>, ' +
                'open <strong>Edit the system environment variables</strong>, click <strong>Environment Variables</strong>, ' +
                'look for <strong>' + (s.provider === 'sendgrid' ? 'SENDGRID_API_KEY' : 'RESEND_API_KEY') +
                '</strong> in both lists, select it, click <strong>Delete</strong>, then <strong>OK</strong>. ' +
                'Restart the server afterwards.</p>';
            }
            if (f.hasStrayQuotes) {
              html += '<p style="' + body + '">The key in the file also has a space or a quote mark inside it. ' +
                'It should sit between the two quote marks with nothing else.</p>';
            }
            return html + '</div>';
          }

          // File and server agree. Only worth saying anything if the file has a
          // problem the provider would report as a plain "unauthorized".
          if (f.occurrences > 1) {
            html += '<div style="' + amber + '"><strong style="color: #ffc107;">The key is listed ' + f.occurrences +
              ' times in the settings file.</strong>' +
              '<p style="' + body + '">The last one wins, so an older line further up is being ignored. ' +
              'Delete the spare lines to avoid confusion.</p></div>';
          }
          if (f.hasStrayQuotes) {
            html += '<div style="' + amber + '"><strong style="color: #ffc107;">The key has extra characters in it.</strong>' +
              '<p style="' + body + '">There is a space or a quote mark inside the key itself, which the email company ' +
              'rejects as if the key were wrong. Open the file and make sure the key sits between the two quote marks ' +
              'with nothing else.</p></div>';
          }

          if (!html) {
            html = '<p style="color: #888; font-size: 13px; margin-bottom: 16px;">' +
              'This is the key from ' + escapeHtml(f.path) + ', so the file and the server agree.</p>';
          }
          return html;
        }

        // Times come back as ISO strings; show them in the office's own clock.
        function formatWhen(iso) {
          if (!iso) return 'an unknown time';
          const d = new Date(iso);
          return isNaN(d.getTime()) ? 'an unknown time' : d.toLocaleString();
        }

        async function loadEmailStatus() {
          const loadingEl = document.getElementById('emailStatusLoading');
          const boxEl = document.getElementById('emailStatusBox');
          loadingEl.style.display = 'block';
          boxEl.style.display = 'none';

          try {
            const res = await fetch(API_BASE + '/email/status');
            const data = await res.json();
            const s = data.data;

            // The stored name is lowercase; these are the companies' own spellings.
            const providerName = s.provider === 'sendgrid' ? 'SendGrid' : 'Resend';

            let html = '';

            if (!s.configured) {
              html += '<div style="background: #3a1a1a; border-left: 4px solid #dc3545; padding: 16px; border-radius: 6px; margin-bottom: 16px;">' +
                '<strong style="color: #ff6b6b;">Emails are switched off on this server.</strong>' +
                '<p style="color: #ccc; margin: 8px 0 0;">No email key is set, so pledge photos are saved but never sent. ' +
                'Add your Resend key to the settings file on the server and restart it. ' +
                'Anything already waiting below will go out automatically once you do — nothing is lost.</p>' +
                '</div>';
            } else if (!s.processorRunning) {
              html += '<div style="background: #3a2f1a; border-left: 4px solid #ffc107; padding: 16px; border-radius: 6px; margin-bottom: 16px;">' +
                '<strong style="color: #ffc107;">A key is set, but sending was not started.</strong>' +
                '<p style="color: #ccc; margin: 8px 0 0;">The key was added after the server started. Restart the server to begin sending.</p>' +
                '</div>';
            } else {
              html += '<div style="background: #1a3a1a; border-left: 4px solid #28a745; padding: 16px; border-radius: 6px; margin-bottom: 16px;">' +
                '<strong style="color: #4ade80;">Emails are switched on.</strong>' +
                '<p style="color: #ccc; margin: 8px 0 0;">Sending through ' + providerName +
                ', checked every 30 seconds. Use the test below to confirm mail actually arrives.</p>' +
                '</div>';
            }

            html += '<p style="color: #888; margin-bottom: 4px;">Sent from</p>' +
              '<p style="color: #fff; margin-bottom: 16px;">' + escapeHtml(s.fromName) + ' &lt;' + escapeHtml(s.fromAddress) + '&gt;</p>';

            if (s.configured) {
              html += '<p style="color: #888; font-size: 13px; margin-bottom: 16px;">' +
                'This address has to be on a domain you have verified with ' + providerName + '. ' +
                'If it is not, every email is rejected even though the key is correct — the test below will say so.</p>';

              // The key the server is actually using, shown as the provider's
              // own dashboard shows it. When a key is refused, the first thing
              // worth knowing is whether the file holds the key you think it
              // does — and whether all of it arrived.
              html += '<p style="color: #888; margin-bottom: 4px;">Key this server is using</p>' +
                '<p style="color: #fff; margin-bottom: 8px; font-family: monospace;">' +
                escapeHtml(s.keyPreview || '') + '&hellip; <span style="color: #888; font-family: inherit;">(' +
                s.keyLength + ' characters)</span></p>';

              if (s.provider === 'resend') {
                // Every complete Resend key seen so far is 36 characters.
                // Treated as a hint, not a verdict: a full-length key can still
                // be the wrong key, and only the send test settles it.
                html += s.keyLength < 30
                  ? '<p style="color: #ffc107; font-size: 13px; margin-bottom: 16px;">' +
                    'That looks short for a Resend key, which is normally about 36 characters. ' +
                    'It was probably cut off when it was copied.</p>'
                  : '<p style="color: #888; font-size: 13px; margin-bottom: 16px;">' +
                    'That is a normal length for a Resend key. Compare the opening characters against your key list ' +
                    'at resend.com/api-keys — if no key there starts the same way, this one has been deleted.</p>';
              }

              html += renderEnvFileCheck(s);
            }

            html += '<div class="stats-grid">' +
              '<div class="stat-card"><h3>Delivered</h3><div class="value">' + s.pledges.delivered + '</div></div>' +
              '<div class="stat-card"><h3>Waiting to send</h3><div class="value">' + s.queue.pending + '</div></div>' +
              '<div class="stat-card"><h3>Failed</h3><div class="value">' + s.queue.failed + '</div></div>' +
              '<div class="stat-card"><h3>No email given</h3><div class="value">' + s.pledges.noEmailGiven + '</div></div>' +
              '</div>';

            boxEl.innerHTML = html;
            loadingEl.style.display = 'none';
            boxEl.style.display = 'block';
          } catch (err) {
            console.error('Failed to load email status:', err);
            loadingEl.textContent = 'Could not check email status.';
          }
        }

        // Asks the server to contact Resend with no key attached, purely to see
        // who answers. A valid key that still comes back "unauthorized" means
        // the reply was never Resend's, and this is what tells the two apart.
        async function checkResendConnection() {
          const btn = document.getElementById('connCheckBtn');
          const resultEl = document.getElementById('connCheckResult');
          btn.disabled = true;
          btn.textContent = 'Checking...';
          resultEl.style.display = 'none';

          const green = 'background: #1a3a1a; border-left: 4px solid #28a745; padding: 16px; border-radius: 6px;';
          const red = 'background: #3a1a1a; border-left: 4px solid #dc3545; padding: 16px; border-radius: 6px;';
          const body = 'color: #ccc; margin: 8px 0 0;';
          const mono = 'color: #888; margin: 12px 0 0; font-family: monospace; font-size: 12px; word-break: break-all;';

          try {
            const res = await fetch(API_BASE + '/email/connection-check');
            const payload = await res.json();
            const r = payload.data;
            let html = '';

            if (r.verdict === 'clean') {
              html = '<div style="' + green + '"><strong style="color: #4ade80;">This computer can reach Resend normally.</strong>' +
                '<p style="' + body + '">Resend itself answered, so nothing on this network is blocking email. ' +
                'If sending still fails, the reason given by the test above is genuinely coming from Resend.</p></div>';
            } else if (r.verdict === 'no-connection') {
              const cert = /certificate|self.signed|unable to verify|SSL|TLS/i.test(r.error || '');
              html = '<div style="' + red + '"><strong style="color: #ff6b6b;">Could not reach Resend at all.</strong>' +
                (cert
                  ? '<p style="' + body + '">The connection was re-signed by something else on the way out — ' +
                    'that is security software or a firewall inspecting secure traffic. It has to be told to leave ' +
                    'api.resend.com alone.</p>'
                  : '<p style="' + body + '">Check this computer has working internet. If other websites load fine, ' +
                    'then api.resend.com specifically is being blocked.</p>') +
                '<p style="' + mono + '">' + escapeHtml(r.error || '') + '</p></div>';
            } else {
              html = '<div style="' + red + '"><strong style="color: #ff6b6b;">Something answered instead of Resend.</strong>' +
                '<p style="' + body + '">The request left this computer but never arrived. Whatever replied is what has ' +
                'been stopping your emails — and it explains a valid key being reported as unauthorized. ' +
                'Usually this is antivirus or security software inspecting secure connections, a company firewall, ' +
                'or a guest Wi-Fi login page.</p>' +
                '<p style="' + body + '">Quickest way to confirm: put this computer on a phone hotspot and press ' +
                'Check Connection again. If it goes green, the original network is the problem and api.resend.com ' +
                'needs to be allowed through it.</p>' +
                '<p style="' + mono + '">Replied with HTTP ' + escapeHtml(String(r.status)) +
                (r.serverHeader ? ' from "' + escapeHtml(r.serverHeader) + '"' : '') +
                '<br>' + escapeHtml(r.bodySnippet || '(empty reply)') + '</p></div>';
            }

            // A proxy setting redirects every outbound request before it leaves,
            // so it can produce this on an otherwise healthy network.
            if (r.proxyVariables && r.proxyVariables.length) {
              html += '<div style="' + red + ' margin-top: 12px;"><strong style="color: #ff6b6b;">This server is set to send traffic through a proxy.</strong>' +
                '<p style="' + body + '">A proxy setting was found on this computer. Everything the server sends goes ' +
                'through it first, so if it is wrong or out of date it will answer instead of Resend. ' +
                'If you did not set this up deliberately, it should be removed.</p>' +
                '<p style="' + mono + '">' +
                r.proxyVariables.map(function (v) { return escapeHtml(v.name) + ' = ' + escapeHtml(v.value); }).join('<br>') +
                '</p></div>';
            }

            resultEl.innerHTML = html;
            resultEl.style.display = 'block';
          } catch (err) {
            resultEl.innerHTML = '<div style="' + red + '"><strong style="color: #ff6b6b;">Could not run the check.</strong>' +
              '<p style="' + body + '">The admin site could not reach this server.</p></div>';
            resultEl.style.display = 'block';
          } finally {
            btn.disabled = false;
            btn.textContent = 'Check Connection';
          }
        }

        async function sendTestEmail() {
          const input = document.getElementById('testEmailAddress');
          const btn = document.getElementById('testEmailBtn');
          const resultEl = document.getElementById('testEmailResult');
          const address = input.value.trim();

          // Checked here as well as on the server: the server answers a bad
          // address with a raw validation dump, which is no use to anyone.
          if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(address)) {
            resultEl.innerHTML = '<span style="color: #ff6b6b;">Enter a valid email address first.</span>';
            resultEl.style.display = 'block';
            return;
          }

          btn.disabled = true;
          btn.textContent = 'Sending...';
          resultEl.style.display = 'none';

          try {
            const res = await fetch(API_BASE + '/email/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: address })
            });
            const data = await res.json();

            if (res.ok && data.data) {
              resultEl.innerHTML = '<div style="background: #1a3a1a; border-left: 4px solid #28a745; padding: 16px; border-radius: 6px;">' +
                '<strong style="color: #4ade80;">Handed to the email provider.</strong>' +
                '<p style="color: #ccc; margin: 8px 0 0;">Check ' + escapeHtml(address) +
                ', including the junk folder. If it never arrives, the provider accepted it but did not deliver it — check your account there.</p>' +
                '</div>';
            } else {
              const raw = data.error && data.error.message ? data.error.message : 'Unknown problem';
              const plain = explainEmailError(raw);

              // Plain-English cause first, the provider's exact words second.
              // The raw text stays visible because it is the only thing worth
              // pasting to someone else when the cause isn't one we recognise.
              resultEl.innerHTML = '<div style="background: #3a1a1a; border-left: 4px solid #dc3545; padding: 16px; border-radius: 6px;">' +
                '<strong style="color: #ff6b6b;">It did not send.</strong>' +
                (plain ? '<p style="color: #fff; margin: 8px 0 0;">' + escapeHtml(plain) + '</p>' : '') +
                '<p style="color: #888; font-size: 12px; margin: 12px 0 0; word-break: break-word;">' +
                escapeHtml(raw) + '</p>' +
                '</div>';
            }
            resultEl.style.display = 'block';
          } catch (err) {
            console.error('Test email failed:', err);
            resultEl.innerHTML = '<span style="color: #ff6b6b;">Could not reach the server.</span>';
            resultEl.style.display = 'block';
          } finally {
            btn.disabled = false;
            btn.textContent = 'Send Test';
          }
        }

        async function loadEmailQueue() {
          const loadingEl = document.getElementById('emailQueueLoading');
          const tableEl = document.getElementById('emailQueueTable');
          const emptyEl = document.getElementById('emailQueueEmpty');
          const bodyEl = document.getElementById('emailQueueBody');

          loadingEl.style.display = 'block';
          tableEl.style.display = 'none';
          emptyEl.style.display = 'none';

          try {
            const res = await fetch(API_BASE + '/email/queue/items?limit=50');
            const data = await res.json();
            const items = data.data || [];

            loadingEl.style.display = 'none';

            if (items.length === 0) {
              emptyEl.style.display = 'block';
              return;
            }

            bodyEl.innerHTML = items.map(item => {
              const badge = item.status === 'failed'
                ? '<span class="badge badge-danger">Failed</span>'
                : item.status === 'processing'
                  ? '<span class="badge badge-warning">Sending</span>'
                  : '<span class="badge badge-warning">Waiting</span>';
              const venue = item.pledge && item.pledge.event ? item.pledge.event.venueName : '';
              const plain = explainEmailError(item.lastError);
              const problem = item.lastError
                ? (plain ? escapeHtml(plain) : escapeHtml(item.lastError))
                : '';
              return \`
                <tr>
                  <td>\${new Date(item.scheduledAt).toLocaleString()}</td>
                  <td>\${escapeHtml(item.toEmail || '')}</td>
                  <td>\${escapeHtml(venue || '')}</td>
                  <td>\${badge}</td>
                  <td>\${item.attempts} of \${item.maxAttempts}</td>
                  <td style="max-width: 360px; word-break: break-word; color: #888; font-size: 12px;">\${problem}</td>
                </tr>
              \`;
            }).join('');

            tableEl.style.display = 'table';
          } catch (err) {
            console.error('Failed to load email queue:', err);
            loadingEl.textContent = 'Could not load the email queue.';
          }
        }

        async function retryFailedEmails() {
          if (!confirm('Try sending all failed emails again?')) return;

          try {
            const res = await fetch(API_BASE + '/email/retry-failed', { method: 'POST' });
            const data = await res.json();
            const count = data.data ? data.data.resetCount : 0;

            if (count === 0) {
              alert('There are no failed emails to retry.');
            } else {
              // Nudge the queue rather than waiting up to 30 seconds, so the
              // result of the retry is visible straight away.
              await fetch(API_BASE + '/email/process', { method: 'POST' }).catch(() => {});
              alert(count + ' email' + (count === 1 ? '' : 's') + ' queued to try again.');
            }

            loadEmailStatus();
            loadEmailQueue();
          } catch (err) {
            console.error('Retry failed:', err);
            alert('Could not retry the failed emails.');
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
