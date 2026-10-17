import { describe, expect, it } from "vitest";
import {
  canInitiateConversation,
  sendConnectionRequest,
  respondToConnectionRequest,
  cancelConnectionRequest,
  removeConnection,
  fetchConnections,
  fetchPendingRequests,
} from "@/services/connections";

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
  private blocks: Set<string> = new Set();

  private getPairKey(a: string, b: string) {
    return [a, b].sort().join("::");
  }

  block(blockerId: string, blockedId: string) {
    this.blocks.add(`${blockerId}::${blockedId}`);
  }

  sendRequest(
    requesterId: string,
    addresseeId: string,
  ): { success: boolean; status: ConnectionStatus; error?: string } {
    if (requesterId === addresseeId) {
      return { success: false, status: "none", error: "Cannot connect to self" };
    }

    if (
      this.blocks.has(`${requesterId}::${addresseeId}`) ||
      this.blocks.has(`${addresseeId}::${requesterId}`)
    ) {
      return { success: false, status: "none", error: "Unable to connect to this user" };
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

  remove(callerId: string, userA: string, userB: string) {
    const key = this.getPairKey(userA, userB);
    const conn = this.connections.get(key);
    if (!conn) return { success: false, error: "Not found" };

    if (conn.requesterId !== callerId && conn.addresseeId !== callerId) {
      return { success: false, error: "Not authorized to remove connection" };
    }

    conn.status = "removed";
    return { success: true };
  }

  canMessage(userA: string, userB: string): boolean {
    const key = this.getPairKey(userA, userB);
    const conn = this.connections.get(key);
    return conn?.status === "accepted";
  }
}

describe("Phase 8: Real Connection System", () => {
  describe("1. Connection State Machine & Permissions", () => {
    it("rejects self-connection attempts", () => {
      const manager = new ConnectionManager();
      const res = manager.sendRequest("user-1", "user-1");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Cannot connect to self");
    });

    it("prevents connection requests between blocked users", () => {
      const manager = new ConnectionManager();
      manager.block("user-b", "user-a");

      const res = manager.sendRequest("user-a", "user-b");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Unable to connect to this user");
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

    it("allows sender to cancel a pending request", () => {
      const manager = new ConnectionManager();
      manager.sendRequest("user-a", "user-b");

      // Non-sender cannot cancel
      const unauthorizedCancel = manager.cancel("user-b", "user-a", "user-b");
      expect(unauthorizedCancel.success).toBe(false);
      expect(unauthorizedCancel.error).toBe("Only sender can cancel");

      // Sender can cancel
      const authorizedCancel = manager.cancel("user-a", "user-a", "user-b");
      expect(authorizedCancel.success).toBe(true);
      expect(manager.canMessage("user-a", "user-b")).toBe(false);
    });

    it("allows either party to remove an accepted connection", () => {
      const manager = new ConnectionManager();
      manager.sendRequest("user-a", "user-b");
      manager.respond("user-b", "user-a", "user-b", "accepted");
      expect(manager.canMessage("user-a", "user-b")).toBe(true);

      // Party A removes
      const res = manager.remove("user-a", "user-a", "user-b");
      expect(res.success).toBe(true);
      expect(manager.canMessage("user-a", "user-b")).toBe(false);
    });

    it("re-opens previously canceled or declined connection upon new request", () => {
      const manager = new ConnectionManager();
      manager.sendRequest("user-a", "user-b");
      manager.respond("user-b", "user-a", "user-b", "declined");

      // Re-send request
      const res = manager.sendRequest("user-a", "user-b");
      expect(res.success).toBe(true);
      expect(res.status).toBe("pending");
    });
  });

  describe("2. Client Service Operations & Helpers", () => {
    it("canInitiateConversation strictly gates on accepted connection status", () => {
      const connections: Record<string, "pending" | "connected"> = {
        mira: "connected",
        eli: "pending",
      };

      expect(canInitiateConversation(connections, "mira")).toBe(true);
      expect(canInitiateConversation(connections, "eli")).toBe(false);
      expect(canInitiateConversation(connections, "kai")).toBe(false);
    });

    it("sendConnectionRequest validates self-connection on client side", async () => {
      const res = await sendConnectionRequest("user-123", "user-123");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Cannot connect to self");
    });

    it("sendConnectionRequest handles demo mode gracefully", async () => {
      const res = await sendConnectionRequest("mira", "demo");
      expect(res.success).toBe(true);
      expect(res.status).toBe("pending");
      expect(res.error).toBeNull();
    });

    it("respondToConnectionRequest handles demo acceptance and decline gracefully", async () => {
      const accept = await respondToConnectionRequest("mira", "accepted", "demo");
      expect(accept.success).toBe(true);
      expect(accept.error).toBeNull();

      const decline = await respondToConnectionRequest("mira", "declined", "demo");
      expect(decline.success).toBe(true);
      expect(decline.error).toBeNull();
    });

    it("cancelConnectionRequest and removeConnection handle demo mode gracefully", async () => {
      const cancel = await cancelConnectionRequest("mira", "demo");
      expect(cancel.success).toBe(true);
      expect(cancel.error).toBeNull();

      const remove = await removeConnection("mira", "demo");
      expect(remove.success).toBe(true);
      expect(remove.error).toBeNull();
    });

    it("fetchConnections and fetchPendingRequests return safe fallbacks for demo user", async () => {
      const conns = await fetchConnections("demo");
      expect(conns).toEqual({});

      const pending = await fetchPendingRequests("demo");
      expect(pending.incoming).toEqual([]);
      expect(pending.outgoing).toEqual([]);
    });
  });
});
