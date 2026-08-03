import { SIGNOFF_ROWS } from "@/lib/print";

/** Requested / Checked / Verified / Approved sign-off block, aligned in columns. */
export function SignOffBlock() {
  return (
    <div className="signoff mt-8 border-t pt-4 text-sm">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left font-semibold p-1">&nbsp;</th>
            <th className="text-left font-semibold p-1">Name</th>
            <th className="text-left font-semibold p-1">Department</th>
            <th className="text-left font-semibold p-1">Date</th>
            <th className="text-left font-semibold p-1">Sign</th>
          </tr>
        </thead>
        <tbody>
          {SIGNOFF_ROWS.map((r) => (
            <tr key={r}>
              <td className="p-1 font-medium whitespace-nowrap">{r}</td>
              <td className="p-1">.............................</td>
              <td className="p-1">.............................</td>
              <td className="p-1">....................</td>
              <td className="p-1">....................</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
