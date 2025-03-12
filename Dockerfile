# ---- deps ----
FROM groupclaes/esbuild:v0.25.0 AS depedencies
WORKDIR /usr/src/app

COPY package.json ./package.json
COPY .npmrc ./.npmrc

RUN npm install --omit=dev --ignore-scripts

# ---- build ----
FROM depedencies AS build
COPY index.ts ./index.ts
COPY src/ ./src

RUN npm install --ignore-scripts && npm run build

# ---- final ----
FROM groupclaes/node:22
# add lib form pdf and image manipulation
USER root
RUN apk add --no-cache file imagemagick

USER node
WORKDIR /usr/src/app

COPY ./src/assets ./assets/
COPY --from=depedencies /usr/src/app ./
COPY --from=build /usr/src/app/index.min.js ./

CMD ["node","index.min.js"]