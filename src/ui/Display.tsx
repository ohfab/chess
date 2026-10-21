/**
 * A page title in the big uppercase style: the first line flush left, the second pushed to
 * the right with an optional small caption in front of it.
 */
export function Display({ first, second, note }: { first: string; second?: string; note?: string }) {
  return (
    <h2 className="display">
      <span>{first}</span>
      {second && (
        <span className="display-2">
          <small>{note}</small>
          <span>{second}</span>
        </span>
      )}
    </h2>
  )
}
