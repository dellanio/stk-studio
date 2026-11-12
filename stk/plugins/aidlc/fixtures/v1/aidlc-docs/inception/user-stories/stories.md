# User Stories

## Epic: Expense submission

### US-001: Submit an expense request
**As an** employee, **I want** to submit an expense with its receipt, **so that** I get reimbursed.

**Priority**: Must Have

**Acceptance Criteria**:
- Given I am signed in, when I attach a receipt and submit, then the request is created as pending.
- Given a request without a receipt, when I submit, then I see a validation message.

### US-002: Track my requests
**As an** employee, **I want** to see the status of my requests, **so that** I know when I will be paid.

**Priority**: Should Have

**Acceptance Criteria**:
- Given I have requests, when I open the list, then I see each status and date.

## Epic: Approval

### US-003: Approve a request
**As a** manager, **I want** to approve or reject requests from my team, **so that** valid expenses are paid.

**Priority**: Must Have

**Acceptance Criteria**:
1. Given a pending request, when I approve it, then it moves to finance.
2. Given a pending request, when I reject it with a reason, then the employee is notified.
