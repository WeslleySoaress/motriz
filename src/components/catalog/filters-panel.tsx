'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import {
  BODY_TYPES,
  BODY_TYPE_LABELS,
  FUELS,
  FUEL_LABELS,
  TRANSMISSIONS,
  TRANSMISSION_LABELS,
} from '@/lib/enums'
import { PARAM, type CatalogFilters } from '@/lib/catalog'
import { Checkbox, Input, Select } from '@/components/ui/field'
import { Button } from '@/components/ui/button'

/**
 * Painel de filtros.
 *
 * É um <form method="get"> de verdade: sem JavaScript, o botão "Aplicar"
 * navega para /catalogo com os parâmetros na URL e a página funciona igual.
 * Com JavaScript, o formulário é enviado sozinho quando um filtro muda —
 * marcação e texto com uma pequena espera, para não navegar a cada tecla.
 *
 * Isso também garante o requisito de filtros compartilháveis: o estado mora
 * na URL, não em memória do cliente.
 */
export function FiltersPanel({
  filters,
  brands,
  states,
  bodyCounts,
  resultCount,
}: {
  filters: CatalogFilters
  brands: { brand: string; count: number }[]
  states: { state: string; count: number }[]
  bodyCounts: Record<string, number>
  resultCount: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Celular: botão que abre o painel em tela cheia. */}
      <div className="lg:hidden">
        <Button
          type="button"
          variant="contorno"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="w-full"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filtrar e ordenar
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtros do catálogo"
            className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-xl border-t border-line bg-surface"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold">Filtros</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 items-center justify-center rounded-md border border-line text-fg-muted"
              >
                <X size={18} aria-hidden="true" />
                <span className="apenas-leitor">Fechar filtros</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
              <FiltersForm
                filters={filters}
                brands={brands}
                states={states}
                bodyCounts={bodyCounts}
                autoSubmit={false}
                submitLabel={`Ver ${resultCount} resultado${resultCount === 1 ? '' : 's'}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Telas grandes: painel fixo na coluna lateral. */}
      <div className="hidden lg:block">
        <FiltersForm
          filters={filters}
          brands={brands}
          states={states}
          bodyCounts={bodyCounts}
          autoSubmit
        />
      </div>
    </>
  )
}

function FiltersForm({
  filters,
  brands,
  states,
  bodyCounts,
  autoSubmit,
  submitLabel = 'Aplicar filtros',
}: {
  filters: CatalogFilters
  brands: { brand: string; count: number }[]
  states: { state: string; count: number }[]
  bodyCounts: Record<string, number>
  autoSubmit: boolean
  submitLabel?: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current) }, [])

  function submit(delay = 0) {
    if (!autoSubmit) return
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => {
      const form = formRef.current
      if (!form) return
      const data = new FormData(form)
      const params = new URLSearchParams()
      for (const [key, value] of data.entries()) {
        const v = String(value).trim()
        if (v) params.append(key, v)
      }
      router.push(params.toString() ? `/catalogo?${params}` : '/catalogo')
    }, delay)
  }

  return (
    <form
      ref={formRef}
      action="/catalogo"
      method="get"
      className="flex flex-col gap-7"
    >
      {/* Mantém o termo buscado ao aplicar um filtro. */}
      {filters.q && <input type="hidden" name={PARAM.q} value={filters.q} />}
      {/* Qualquer mudança de filtro volta para a primeira página. */}
      <input type="hidden" name={PARAM.page} value="1" />
      {filters.sort !== 'recentes' && (
        <input type="hidden" name={PARAM.sort} value={filters.sort} />
      )}

      <Group title="Marca">
        <div className="trilha-x max-h-56 overflow-y-auto pr-1">
          <ul className="flex flex-col gap-2">
            {brands.length === 0 && (
              <li className="text-sm text-fg-muted">Nenhuma marca disponível ainda.</li>
            )}
            {brands.map(({ brand, count }) => (
              <li key={brand}>
                <Checkbox
                  id={`marca-${brand}`}
                  name={PARAM.brands}
                  value={brand}
                  defaultChecked={filters.brands.includes(brand)}
                  onChange={() => submit()}
                  label={
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>{brand}</span>
                      <span className="text-xs text-fg-subtle tabular">{count}</span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      </Group>

      <Group title="Modelo">
        <Input
          name={PARAM.model}
          defaultValue={filters.model}
          placeholder="Ex.: Corolla"
          aria-label="Filtrar por modelo"
          onChange={() => submit(600)}
        />
      </Group>

      <Group title="Preço (R$)">
        <div className="grid grid-cols-2 gap-2">
          <Input
            name={PARAM.priceMin}
            inputMode="numeric"
            defaultValue={filters.priceMin !== null ? Math.round(filters.priceMin / 100) : ''}
            placeholder="Mínimo"
            aria-label="Preço mínimo em reais"
            onChange={() => submit(700)}
          />
          <Input
            name={PARAM.priceMax}
            inputMode="numeric"
            defaultValue={filters.priceMax !== null ? Math.round(filters.priceMax / 100) : ''}
            placeholder="Máximo"
            aria-label="Preço máximo em reais"
            onChange={() => submit(700)}
          />
        </div>
      </Group>

      <Group title="Ano do modelo">
        <div className="grid grid-cols-2 gap-2">
          <Input
            name={PARAM.yearMin}
            inputMode="numeric"
            maxLength={4}
            defaultValue={filters.yearMin ?? ''}
            placeholder="De"
            aria-label="Ano mínimo"
            onChange={() => submit(700)}
          />
          <Input
            name={PARAM.yearMax}
            inputMode="numeric"
            maxLength={4}
            defaultValue={filters.yearMax ?? ''}
            placeholder="Até"
            aria-label="Ano máximo"
            onChange={() => submit(700)}
          />
        </div>
      </Group>

      <Group title="Quilometragem máxima">
        <Select
          name={PARAM.kmMax}
          defaultValue={filters.kmMax ?? ''}
          aria-label="Quilometragem máxima"
          onChange={() => submit()}
        >
          <option value="">Qualquer</option>
          <option value="20000">Até 20.000 km</option>
          <option value="50000">Até 50.000 km</option>
          <option value="80000">Até 80.000 km</option>
          <option value="120000">Até 120.000 km</option>
          <option value="200000">Até 200.000 km</option>
        </Select>
      </Group>

      <Group title="Carroceria">
        <ul className="grid grid-cols-2 gap-2">
          {BODY_TYPES.map((body) => {
            const count = bodyCounts[body] ?? 0
            return (
              <li key={body}>
                <Checkbox
                  id={`carroceria-${body}`}
                  name={PARAM.bodyTypes}
                  value={body}
                  disabled={count === 0 && !filters.bodyTypes.includes(body)}
                  defaultChecked={filters.bodyTypes.includes(body)}
                  onChange={() => submit()}
                  label={
                    <span className={count === 0 ? 'text-fg-subtle' : undefined}>
                      {BODY_TYPE_LABELS[body]}{' '}
                      <span className="text-xs text-fg-subtle tabular">({count})</span>
                    </span>
                  }
                />
              </li>
            )
          })}
        </ul>
      </Group>

      <Group title="Combustível">
        <ul className="grid grid-cols-2 gap-2">
          {FUELS.map((fuel) => (
            <li key={fuel}>
              <Checkbox
                id={`combustivel-${fuel}`}
                name={PARAM.fuels}
                value={fuel}
                defaultChecked={filters.fuels.includes(fuel)}
                onChange={() => submit()}
                label={FUEL_LABELS[fuel]}
              />
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Câmbio">
        <ul className="grid grid-cols-2 gap-2">
          {TRANSMISSIONS.map((t) => (
            <li key={t}>
              <Checkbox
                id={`cambio-${t}`}
                name={PARAM.transmissions}
                value={t}
                defaultChecked={filters.transmissions.includes(t)}
                onChange={() => submit()}
                label={TRANSMISSION_LABELS[t]}
              />
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Localização">
        <div className="flex flex-col gap-2">
          <Select
            name={PARAM.state}
            defaultValue={filters.state ?? ''}
            aria-label="Estado"
            onChange={() => submit()}
          >
            <option value="">Todos os estados</option>
            {states.map(({ state, count }) => (
              <option key={state} value={state}>
                {state} ({count})
              </option>
            ))}
          </Select>
          <Input
            name={PARAM.city}
            defaultValue={filters.city}
            placeholder="Cidade"
            aria-label="Cidade"
            onChange={() => submit(600)}
          />
        </div>
      </Group>

      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <Button type="submit" variant={autoSubmit ? 'secundario' : 'primario'} size="md">
          {submitLabel}
        </Button>
        <a
          href="/catalogo"
          className="alvo-toque inline-flex h-11 items-center justify-center rounded-md text-sm font-medium text-fg-muted transition-colors hover:text-fg"
        >
          Limpar todos os filtros
        </a>
      </div>
    </form>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="rotulo mb-3">{title}</legend>
      {children}
    </fieldset>
  )
}
