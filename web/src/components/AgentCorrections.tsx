import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { agentRequest } from "@/lib/agent-bridge";

function Proposal({
  memoName,
  proposal,
  done,
  disabled,
}: {
  memoName: string;
  proposal: { id: string; text: string };
  done: () => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(proposal.text);
  const mutation = useMutation({
    mutationFn: () => agentRequest(memoName, `/corrections/${proposal.id}/confirm`, { text, request_id: crypto.randomUUID() }),
    onSuccess: done,
  });
  return (
    <div className="rounded border p-2">
      <label>
        Proposed remembered correction
        <textarea
          aria-label="Proposed remembered correction"
          className="w-full border bg-background p-2"
          maxLength={16000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <Button disabled={disabled || mutation.isPending || !text.trim()} onClick={() => mutation.mutate()}>
        Confirm remembered correction
      </Button>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </div>
  );
}
export default function AgentCorrections({
  memoName,
  userName,
  version,
  disabled,
  done,
}: {
  memoName: string;
  userName: string;
  version: number;
  disabled: boolean;
  done: () => void;
}) {
  const query = useQuery({
    queryKey: ["agent-corrections", userName, memoName, version],
    queryFn: () => agentRequest<{ id: string; text: string }[]>(memoName, "/corrections"),
    enabled: !disabled,
    retry: false,
  });
  return (
    <>
      {query.data?.map((p) => (
        <Proposal
          key={p.id}
          memoName={memoName}
          proposal={p}
          disabled={disabled}
          done={() => {
            void query.refetch();
            done();
          }}
        />
      ))}
      {query.error && <p role="alert">Correction proposals are unavailable.</p>}
    </>
  );
}
