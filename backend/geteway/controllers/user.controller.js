const getCurrentUser = async (req, res) => {
    try {
        const user = { ...req.user, _id: req.user.userId || req.user._id };
        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({
            message: `Get Current user error ${error}`
        });
    }
};

export default getCurrentUser;