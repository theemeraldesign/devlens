import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { EnvironmentVariable, LocalEnvironment } from "../lib/environments";

type Props = {
  initial: LocalEnvironment | null;
  onClose: () => void;
  onSave: (environment: LocalEnvironment) => void;
  onDelete: (id: string) => void;
};

const newVariable = (): EnvironmentVariable => ({ id: crypto.randomUUID(), key: "", value: "", enabled: true });

export default function EnvironmentModal({ initial, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? "New environment");
  const [variables, setVariables] = useState<EnvironmentVariable[]>(initial?.variables ?? [newVariable()]);
  const [error, setError] = useState("");

  function updateVariable(id: string, patch: Partial<EnvironmentVariable>) {
    setVariables(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  function save() {
    if (!name.trim()) {
      setError("Enter an environment name.");
      return;
    }
    const keys = variables.filter(item => item.enabled && item.key.trim()).map(item => item.key.trim());
    if (new Set(keys).size !== keys.length) {
      setError("Variable names must be unique.");
      return;
    }
    onSave({ id: initial?.id ?? crypto.randomUUID(), name: name.trim(), variables, updatedAt: new Date().toISOString() });
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal environment-modal" role="dialog" aria-modal="true" aria-labelledby="environment-title" onClick={event => event.stopPropagation()}>
      <div className="modal-title"><div><span className="utility-kicker">WORKSPACE ENVIRONMENT</span><b id="environment-title">{initial ? "Edit environment" : "Create environment"}</b></div><button onClick={onClose} aria-label="Close"><X size={16}/></button></div>
      <label>ENVIRONMENT NAME</label>
      <input className="environment-name" value={name} onChange={event => setName(event.target.value)} placeholder="Development"/>
      <div className="environment-vars-head"><span>VARIABLE</span><span>VALUE</span><span/></div>
      <div className="environment-vars">
        {variables.map(item => <div className="environment-var" key={item.id}>
          <input type="checkbox" checked={item.enabled} onChange={event => updateVariable(item.id,{enabled:event.target.checked})}/>
          <input value={item.key} onChange={event => updateVariable(item.id,{key:event.target.value})} placeholder="API_BASE_URL"/>
          <input type="password" value={item.value} onChange={event => updateVariable(item.id,{value:event.target.value})} placeholder="Variable value"/>
          <button onClick={() => setVariables(items => items.filter(variable => variable.id !== item.id))} aria-label="Remove variable"><Trash2 size={14}/></button>
        </div>)}
      </div>
      <button className="add-row environment-add" onClick={() => setVariables(items => [...items,newVariable()])}><Plus size={14}/> Add variable</button>
      <p className="environment-note">Use variables as <code>{"{{API_BASE_URL}}"}</code> in request URLs, headers and bodies. Guest values stay in this browser. Signed-in values sync to your private account.</p>
      {error && <div className="auth-message utility-error">{error}</div>}
      <div className="environment-footer">{initial && <button className="environment-delete" onClick={() => onDelete(initial.id)}>Delete environment</button>}<button className="send-button" onClick={save}>Save environment</button></div>
    </section>
  </div>;
}