import { sumBy } from "lodash";

export function total(items) {
  return sumBy(items, (i) => i.price * i.qty);
}
