import { Timestamp } from "firebase/firestore";

export type AuctionStatus = "pre-launch" | "open" | "closed";

export type AuctionConfig = {
  status: AuctionStatus;
  closeAt: Timestamp | null;
  winnersPublished: boolean;
  totalRaised?: number;
  winners?: {
    itemId: string;
    itemTitle: string;
    winnerName: string;
    amount: number;
  }[];
};

export const DEFAULT_AUCTION: AuctionConfig = {
  status: "pre-launch",
  closeAt: null,
  winnersPublished: false,
  totalRaised: 0,
  winners: [],
};

