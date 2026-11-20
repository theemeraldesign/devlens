import { HiOutlineXMark as X } from "react-icons/hi2";
import { useModalAccessibility } from "../hooks/useModalAccessibility";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
};

export default function CollectionModal({ value, onChange, onClose, onCreate }: Props) {
  const dialogRef = useModalAccessibility(onClose);
  return <div className="modal-backdrop" onClick={onClose}>
    <section ref={dialogRef} className="modal collection-modal" role="dialog" aria-modal="true" aria-labelledby="collection-modal-title" onClick={event => event.stopPropagation()}>
      <div className="modal-title"><b id="collection-modal-title">Create a collection</b><button onClick={onClose} aria-label="Close dialog"><X size={16}/></button></div>
      <p>Give your requests a home.</p>
      <label htmlFor="collection-name">COLLECTION NAME</label>
      <input id="collection-name" value={value} onChange={event => onChange(event.target.value)} placeholder="Collection name"/>
      <button className="send-button modal-submit" onClick={onCreate}>Create collection</button>
    </section>
  </div>;
}