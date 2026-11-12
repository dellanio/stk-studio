# User Stories

## Epic 1: Pedido de reembolso

### US1.1: Enviar um pedido de reembolso
As a funcionário, I want to enviar uma despesa com o comprovante, so that eu seja reembolsado.

**Priority**: Must Have

**Acceptance Criteria**:
- AC1.1.1: Given I am signed in, when I attach a receipt and submit, then the request is created as pending.
- AC1.1.2: Given a request without a receipt, when I submit, then I see a validation message.

### US1.2: Acompanhar meus pedidos
As a funcionário, I want to ver o status dos meus pedidos, so that eu saiba quando vou receber.

**Priority**: Should Have

**Acceptance Criteria**:
- AC1.2.1: Given I have requests, when I open the list, then I see each status and date.
