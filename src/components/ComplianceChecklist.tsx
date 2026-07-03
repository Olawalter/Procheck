import { parseMandatoryRequirements } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

interface ComplianceChecklistProps {
  requirementsJson: string;
  checkedItems?: string[];
}

export function ComplianceChecklist({ requirementsJson, checkedItems = [] }: ComplianceChecklistProps) {
  const requirements = parseMandatoryRequirements(requirementsJson);

  return (
    <div className="space-y-2">
      {requirements.map((req, i) => {
        const checked = checkedItems.length === 0 || checkedItems.includes(req);
        return (
          <div key={i} className="flex items-start gap-2.5">
            {checked ? (
              <CheckCircle2 size={15} className="text-compliance-green mt-0.5 shrink-0" />
            ) : (
              <Circle size={15} className="text-slate-grey/40 mt-0.5 shrink-0" />
            )}
            <span
              className={`text-sm leading-snug ${
                checked ? "text-paper-white" : "text-slate-grey"
              }`}
            >
              {req}
            </span>
          </div>
        );
      })}
    </div>
  );
}
