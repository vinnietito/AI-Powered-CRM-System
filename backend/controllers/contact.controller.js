import { Contact } from "../models/Contact.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const getContacts = asyncHandler(async (req, res) => {
    const { search, tag } = req.query;
    const filter = { owner: req.user._id };

    if (tag) filter.tags = tag;
    if (search) {
        const rx = new RegExp(search, "i");
        filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { company: rx }];
    }

    const contacts = (await Contact.find(filter)).toSorted({ favorite: -1, name: 1 });
    res.json({ success: true, count: contacts.length, contacts });
});