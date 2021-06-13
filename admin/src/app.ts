import { Product } from './entity/product';
import * as express from "express";
import * as cors from "cors";

import { createConnection } from "typeorm";
import * as amqp from "amqplib/callback_api";
const queue_config = {
    product_created: "PRODUCT_CREATED",
    product_updated: 'PRODUCT_UPDATED',
    product_deleted: 'PRODUCT_DELETED'
}

createConnection().then(db => {
    const productRepo = db.getRepository(Product);
    amqp.connect('RABITMQURL', (connect_error, connection) => {
        if (connect_error) {
            throw connect_error;
        }
        console.log("connection stablished")
        connection.createChannel((channel_error, channel) => {
            if (channel_error) {
                throw channel_error;
            }
            const app = express();
            app.use(cors({
                origin: ["http://localhost:3000"]
            }))
            app.use(express.json());

            app.get("/api/products", async (req: express.Request, res: express.Response) => {
                const products = await productRepo.find();
                res.json(products);
            })

            app.post("/api/products", async (req: express.Request, res: express.Response) => {
                const product = await productRepo.create(req.body);
                const result = await productRepo.save(product);
                channel.sendToQueue(queue_config.product_created, Buffer.from(JSON.stringify(result)));
                res.json(result);
            });

            app.get("/api/products/:id", async (req: express.Request, res: express.Response) => {
                const product = await productRepo.findOne(req.params.id);
                res.json(product);
            });

            app.put("/api/products/:id", async (req: express.Request, res: express.Response) => {
                const product = await productRepo.findOne(req.params.id);
                productRepo.merge(product, req.body);
                const result = await productRepo.save(product);
                channel.sendToQueue(queue_config.product_updated, Buffer.from(JSON.stringify(result)));
                res.json(result);
            });

            app.delete("/api/products/:id", async (req: express.Request, res: express.Response) => {
                await productRepo.delete(req.params.id);
                channel.sendToQueue(queue_config.product_deleted, Buffer.from(req.params.id));
                res.json({ status: 200 })
            });

            app.post("/api/products/:id/likes", async (req: express.Request, res: express.Response) => {
                const product = await productRepo.findOne(req.params.id);
                product.linkes++;
                const result = await productRepo.save(product);
                res.json(result);
            });

            app.listen(9000, () => {
                console.log("Running on 9000");
                process.on("beforeExit", () => {
                    console.log('closing');
                    connection.close();
                });
            })
        });

    })

}).catch(error => {
    console.log(error);
})
