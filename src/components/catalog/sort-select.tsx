'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SORT_LABELS, SORT_OPTIONS } from '@/lib/enums'
import { PARAM } from '@/lib/catalog'
import { Select } from '@/components/ui/field'

/**
 * Ordenação. Muda um único parâmetro da URL e preserva todos os outros
 * filtros, voltando para a primeira página.
 */
export function SortSelect({ value }: { value: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="ordenacao" className="shrink-0 text-sm text-fg-muted">
        Ordenar por
      </label>
      <Select
        id="ordenacao"
        value={value}
        className="h-10 w-auto min-w-44"
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString())
          if (event.target.value === 'recentes') params.delete(PARAM.sort)
          else params.set(PARAM.sort, event.target.value)
          params.delete(PARAM.page)
          router.push(params.toString() ? `/catalogo?${params}` : '/catalogo')
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </Select>
    </div>
  )
}
