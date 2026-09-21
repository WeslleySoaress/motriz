# Capturas de tela

Geradas por `npm run capturas`, contra o banco de desenvolvimento com os
anúncios de demonstração — portanto com as fotografias reais baixadas do
Wikimedia Commons (ver [IMAGENS.md](IMAGENS.md)).

As imagens são convertidas para WebP logo depois da captura: 41 arquivos,
33 MB em PNG → 6,4 MB em WebP.

> Os anúncios visíveis nas capturas são **de demonstração**. Aparecem com o
> selo correspondente e não correspondem a veículos à venda.

---

## Público

| Tela | Desktop (1440×900) | Celular (Pixel 7) |
| --- | --- | --- |
| Página inicial | [01-inicio](capturas/desktop/01-inicio.webp) · [completa](capturas/desktop/01-inicio-completa.webp) | [01-inicio](capturas/celular/01-inicio.webp) · [completa](capturas/celular/01-inicio-completa.webp) |
| Catálogo | [02-catalogo](capturas/desktop/02-catalogo.webp) | [02-catalogo](capturas/celular/02-catalogo.webp) |
| Catálogo com filtros | [03-catalogo-filtrado](capturas/desktop/03-catalogo-filtrado.webp) | [03-catalogo-filtrado](capturas/celular/03-catalogo-filtrado.webp) |
| Nenhum resultado | [04-catalogo-sem-resultado](capturas/desktop/04-catalogo-sem-resultado.webp) | [04-catalogo-sem-resultado](capturas/celular/04-catalogo-sem-resultado.webp) |
| Página do veículo | [05-veiculo](capturas/desktop/05-veiculo.webp) · [completa](capturas/desktop/05-veiculo-completa.webp) | [05-veiculo](capturas/celular/05-veiculo.webp) · [completa](capturas/celular/05-veiculo-completa.webp) |
| Foto ampliada | [06-veiculo-foto-ampliada](capturas/desktop/06-veiculo-foto-ampliada.webp) | [06-veiculo-foto-ampliada](capturas/celular/06-veiculo-foto-ampliada.webp) |
| Como funciona | [07-sobre](capturas/desktop/07-sobre.webp) | [07-sobre](capturas/celular/07-sobre.webp) |
| Segurança e privacidade | [08-seguranca](capturas/desktop/08-seguranca.webp) | [08-seguranca](capturas/celular/08-seguranca.webp) |
| Entrar | [09-entrar](capturas/desktop/09-entrar.webp) | [09-entrar](capturas/celular/09-entrar.webp) |
| Página não encontrada | [10-nao-encontrada](capturas/desktop/10-nao-encontrada.webp) | [10-nao-encontrada](capturas/celular/10-nao-encontrada.webp) |
| Filtros em painel próprio | — (coluna fixa no desktop) | [11-filtros-celular](capturas/celular/11-filtros-celular.webp) |

## Conta e painel do anunciante

| Tela | Desktop | Celular |
| --- | --- | --- |
| Meus anúncios | [12-painel](capturas/desktop/12-painel.webp) | [12-painel](capturas/celular/12-painel.webp) |
| Favoritos | [13-favoritos](capturas/desktop/13-favoritos.webp) | [13-favoritos](capturas/celular/13-favoritos.webp) |
| Minha conta | [14-conta](capturas/desktop/14-conta.webp) | [14-conta](capturas/celular/14-conta.webp) |
| Editar anúncio | [15-editar-anuncio](capturas/desktop/15-editar-anuncio.webp) | [15-editar-anuncio](capturas/celular/15-editar-anuncio.webp) |

## Administração

| Tela | Desktop | Celular |
| --- | --- | --- |
| Visão geral | [16-admin-visao-geral](capturas/desktop/16-admin-visao-geral.webp) | [16-admin-visao-geral](capturas/celular/16-admin-visao-geral.webp) |
| Anúncios | [17-admin-anuncios](capturas/desktop/17-admin-anuncios.webp) | [17-admin-anuncios](capturas/celular/17-admin-anuncios.webp) |
| Denúncias | [18-admin-denuncias](capturas/desktop/18-admin-denuncias.webp) | [18-admin-denuncias](capturas/celular/18-admin-denuncias.webp) |
| Auditoria | [19-admin-auditoria](capturas/desktop/19-admin-auditoria.webp) | [19-admin-auditoria](capturas/celular/19-admin-auditoria.webp) |

---

## Como refazer

```bash
npm run db:seed     # garante os anúncios de demonstração
npm run capturas    # captura e converte para WebP
```

O script sobe o próprio servidor na porta 3220, usando o banco de
desenvolvimento. Ele não faz nenhuma asserção: navega, espera as fontes e as
imagens visíveis carregarem, e fotografa.
