import type { SubSector } from '../../types';
import { Select } from '../ui';
import { SUBSECTOR_LABEL } from '../../lib/format';

export function TemplatePicker({ onPick, className }: { onPick: (s: SubSector) => void; className?: string }) {
  return (
    <Select
      value=""
      className={className}
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value as SubSector);
      }}
    >
      <option value="">Load template…</option>
      {Object.entries(SUBSECTOR_LABEL).map(([k, v]) => (
        <option key={k} value={k}>{v} line</option>
      ))}
    </Select>
  );
}
