"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type WaiverAcknowledgmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  introBeforeTerms: string;
  body: string;
  agreeLabel: string;
  confirmButtonText: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
};

export function WaiverAcknowledgmentDialog({
  open,
  onOpenChange,
  title,
  introBeforeTerms,
  body,
  agreeLabel,
  confirmButtonText,
  checked,
  onCheckedChange,
  onConfirm,
  confirmDisabled,
}: WaiverAcknowledgmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-left text-xl">{title}</DialogTitle>
          <DialogDescription className="text-left text-slate-600 pt-1">
            {introBeforeTerms}
            <Link
              href="/terms"
              className="text-emerald-600 font-semibold hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {body}
        </div>
        <div className="flex items-start gap-3 pt-2">
          <Checkbox
            id="waiver-ack"
            checked={checked}
            onCheckedChange={(v) => onCheckedChange(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="waiver-ack"
            className="text-sm font-medium leading-snug text-slate-800 cursor-pointer"
          >
            {agreeLabel}
          </Label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white"
            disabled={!checked || confirmDisabled}
            onClick={onConfirm}
          >
            {confirmButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
