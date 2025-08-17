const asyncErrorHandler = (func) => async(req,res,next) => {
    Promise.resolve(
        func(req,res,next)
    ).catch((err) => next(err))
}


export default asyncErrorHandler