import { describe, expect, it } from "vitest";

type ConnectionStatus = "none" | "pending" | "accepted" | "declined" | "canceled" | "removed";

interface ConnectionEntity {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
}

// Emulate backend state transitions enforced by database constraints and RPC
class ConnectionManager {
  private connections: Map<string, ConnectionEntity> = new Map();

  private getPairKey(a: string, b: string) {
    return [a, b].sort().join("::");
  }

  sendRequest(
    requesterId: string,
    addresseeId: string,
  ): { success: boolean; status: ConnectionStatus; error?: string } {
    if (requesterId === addresseeId) {
      return { success: false, status: "none", error: "Cannot connect to self" };
    }

    const key = this.getPairKey(requesterId, addresseeId);
    const existing = this.connections.get(key);

    if (existing) {
      if (existing.status === "accepted") {
        return { success: true, status: "accepted" };
      }
      if (existing.status === "pending") {
        return { success: true, status: "pending" };
      }
      // Re-opening canceled or declined
      existing.status = "pending";
      existing.requesterId = requesterId;
      existing.addresseeId = addresseeId;
      return { success: true, status: "pending" };
    }

    const conn: ConnectionEntity = {
      id: "conn-" + Math.random().toString(36).slice(2),
      requesterId,
      addresseeId,
      status: "pending",
    };
    this.connections.set(key, conn);
    return { success: true, status: "pending" };
  }

  respond(
    callerId: string,
    requesterId: string,
    addresseeId: string,
    action: "accepted" | "declined",
  ) {
    const key = this.getPairKey(requesterId, addresseeId);
    const conn = this.connections.get(key);
    if (!conn) return { success: false, error: "Not found" };

    // Only recipient can accept or decline
    if (conn.addresseeId !== callerId) {
      return { success: false, error: "Only the recipient can respond to this request" };
    }

    conn.status = action;
    return { success: true, status: action };
  }

  cancel(callerId: string, requesterId: string, addresseeId: string) {
    const key = this.getPairKey(requesterId, addresseeId);
    const conn = this.connections.get(key);
    if (!conn) return { success: false, error: "Not found" };

    // Only sender can cancel
    if (conn.requesterId !== callerId) {
      return { success: false, error: "Only sender can cancel" };
    }

    conn.status = "canceled";
    return { success: true };
  }

  canMessage(userA: string, userB: string): boolean {
    const key = this.getPairKey(userA, userB);
    const conn = this.connections.get(key);
    return conn?.status === "accepted";
  }
}

describe("Phase 8: Real Connection System", () => {
  it("rejects self-connection attempts", () => {
    const manager = new ConnectionManager();
    const res = manager.sendRequest("user-1", "user-1");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Cannot connect to self");
  });

  it("handles request creation and prevents unauthorized acceptance", () => {
    const manager = new ConnectionManager();
    const req = manager.sendRequest("user-a", "user-b");
    expect(req.success).toBe(true);
    expect(req.status).toBe("pending");

    // Requester cannot accept their own request
    const unauthorizedAccept = manager.respond("user-a", "user-a", "user-b", "accepted");
    expect(unauthorizedAccept.success).toBe(false);
    expect(unauthorizedAccept.error).toContain("Only the recipient");

    // Recipient can accept
    const authorizedAccept = manager.respond("user-b", "user-a", "user-b", "accepted");
    expect(authorizedAccept.success).toBe(true);
    expect(authorizedAccept.status).toBe("accepted");
  });

  it("allows private messaging only after connection acceptance", () => {
    const manager = new ConnectionManager();
    manager.sendRequest("user-a", "user-b");

    // Still pending, messaging not allowed
    expect(manager.canMessage("user-a", "user-b")).toBe(false);

    // Accept request
    manager.respond("user-b", "user-a", "user-b", "accepted");

    // Now messaging is unlocked
    expect(manager.canMessage("user-a", "user-b")).toBe(true);
  });
});
